#!/usr/bin/env bash
# Provisiona o MovieHub no Azure com a Azure CLI.
#
# Pré-requisitos: az login; Azure Functions Core Tools (func); Node 22; imagens já no Docker Hub.
# Roda em Linux, macOS, WSL ou Git Bash (Windows)
# (../docker-push.sh); repositórios clonados lado a lado.
#
# Segredos entram por variável de ambiente, nunca no código:
#   export DOCKERHUB_USER=...                 # usuário do Docker Hub
#   export MONGODB_URI='mongodb+srv://...'    # connection string do MongoDB Atlas
#   export SQL_ADMIN_PASSWORD='...'           # senha do admin do Azure SQL (criado pelo script)
#   export APIM_PUBLISHER_EMAIL=...           # e-mail exigido pelo API Management
#
# Uso:  ./deploy.sh            (tudo; pode rodar de novo depois de um erro: o que já existe é reaproveitado)
#       ./deploy.sh frontend   (só recompila e publica o frontend)
set -euo pipefail

: "${DOCKERHUB_USER:?defina DOCKERHUB_USER}"

SUFFIX="${SUFFIX:-$(printf '%s' "$DOCKERHUB_USER" | cksum | cut -c1-5)}"
RG="${RG:-rg-moviehub}"
LOCATION="${LOCATION:-eastus2}"
SWA_LOCATION="${SWA_LOCATION:-eastus2}"
STORAGE="${STORAGE:-moviehubst$SUFFIX}"
ACA_ENV="${ACA_ENV:-moviehub-env}"
FUNC_APP="${FUNC_APP:-moviehub-func-$SUFFIX}"
SQL_SERVER="${SQL_SERVER:-moviehub-sql-$SUFFIX}"
SQL_DB="${SQL_DB:-moviehub}"
SQL_ADMIN="${SQL_ADMIN:-moviehubadmin}"
APIM="${APIM:-moviehub-apim-$SUFFIX}"
SWA="${SWA:-moviehub-web-$SUFFIX}"
QUEUE="avaliacoes-eventos"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="$HERE/.deploy-state"   # guarda URLs entre execuções (não vai para o Git)

has() { "$@" -o none >/dev/null 2>&1; }   # o recurso já existe? (permite rodar o script de novo)
app_fqdn() { az containerapp show -n "$1" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv; }
step() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
save() { touch "$STATE"; grep -v "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; }
[ -f "$STATE" ] && source "$STATE"

infra() {
  : "${MONGODB_URI:?defina MONGODB_URI}"
  : "${SQL_ADMIN_PASSWORD:?defina SQL_ADMIN_PASSWORD}"
  : "${APIM_PUBLISHER_EMAIL:?defina APIM_PUBLISHER_EMAIL}"

  step "Azure CLI: extensão do Container Apps e grupo de recursos"
  az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors -o none
  az extension add --name containerapp --upgrade --only-show-errors -o none
  az group create -n "$RG" -l "$LOCATION" -o none
  for p in Microsoft.App Microsoft.OperationalInsights Microsoft.ApiManagement Microsoft.Web Microsoft.Sql Microsoft.Storage; do
    az provider register -n "$p" -o none
  done

  step "Storage Account e fila de eventos"
  az storage account create -n "$STORAGE" -g "$RG" -l "$LOCATION" --sku Standard_LRS --min-tls-version TLS1_2 -o none
  STORAGE_CS=$(az storage account show-connection-string -n "$STORAGE" -g "$RG" -o tsv)
  az storage queue create -n "$QUEUE" --connection-string "$STORAGE_CS" -o none

  step "Azure SQL (servidor + banco serverless na oferta gratuita)"
  has az sql server show -n "$SQL_SERVER" -g "$RG" ||
    az sql server create -n "$SQL_SERVER" -g "$RG" -l "$LOCATION" -u "$SQL_ADMIN" -p "$SQL_ADMIN_PASSWORD" -o none
  az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none
  if ! has az sql db show -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB"; then
    if ! az sql db create -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 1 \
      --use-free-limit --free-limit-exhaustion-behavior AutoPause -o none; then
      echo "Oferta gratuita do Azure SQL indisponível nesta assinatura; criando no plano Basic."
      az sql db create -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" --edition Basic --capacity 5 -o none
    fi
  fi
  SQL_CS="Server=tcp:$SQL_SERVER.database.windows.net,1433;Database=$SQL_DB;User Id=$SQL_ADMIN;Password=$SQL_ADMIN_PASSWORD;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30"

  step "Ambiente do Container Apps"
  has az containerapp env show -n "$ACA_ENV" -g "$RG" || az containerapp env create -n "$ACA_ENV" -g "$RG" -l "$LOCATION" -o none

  step "Microsserviço de filmes (imagem do Docker Hub)"
  if has az containerapp show -n ms-filmes -g "$RG"; then
    MS1=$(app_fqdn ms-filmes)
  else
    MS1=$(az containerapp create -n ms-filmes -g "$RG" --environment "$ACA_ENV" \
      --image "docker.io/$DOCKERHUB_USER/moviehub-ms-filmes:latest" --target-port 8080 --ingress external \
      --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 2 \
      --secrets mongodb-uri="$MONGODB_URI" --env-vars MONGODB_URI=secretref:mongodb-uri MONGODB_DB=moviehub \
      --query properties.configuration.ingress.fqdn -o tsv)
  fi
  save MS1_URL "https://$MS1"

  step "Microsserviço de avaliações (imagem do Docker Hub)"
  if has az containerapp show -n ms-avaliacoes -g "$RG"; then
    MS2=$(app_fqdn ms-avaliacoes)
  else
    MS2=$(az containerapp create -n ms-avaliacoes -g "$RG" --environment "$ACA_ENV" \
      --image "docker.io/$DOCKERHUB_USER/moviehub-ms-avaliacoes:latest" --target-port 8080 --ingress external \
      --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 2 \
      --secrets sql-cs="$SQL_CS" storage-cs="$STORAGE_CS" \
      --env-vars SQL_CONNECTION_STRING=secretref:sql-cs STORAGE_CONNECTION_STRING=secretref:storage-cs EVENTS_QUEUE_NAME="$QUEUE" \
      --query properties.configuration.ingress.fqdn -o tsv)
  fi
  save MS2_URL "https://$MS2"

  step "Azure Function (plano Flex Consumption)"
  has az functionapp show -n "$FUNC_APP" -g "$RG" ||
    az functionapp create -n "$FUNC_APP" -g "$RG" --storage-account "$STORAGE" --flexconsumption-location "$LOCATION" \
      --runtime node --runtime-version 22 -o none
  az functionapp config appsettings set -n "$FUNC_APP" -g "$RG" -o none --settings \
    "MOVIES_SERVICE_URL=https://$MS1" "REVIEWS_SERVICE_URL=https://$MS2" "EventsStorage=$STORAGE_CS" "EVENTS_QUEUE_NAME=$QUEUE"
  (cd "$ROOT/moviehub-function" && npm ci --omit=dev)
  for attempt in 1 2 3; do
    (cd "$ROOT/moviehub-function" && func azure functionapp publish "$FUNC_APP" --javascript) && break
    echo "Publicação da Function falhou (tentativa $attempt); aguardando o Function App ficar pronto..."; sleep 45
  done
  FUNC_KEY=$(az functionapp function keys list -g "$RG" -n "$FUNC_APP" --function-name insights --query default -o tsv)
  save FUNC_URL "https://$FUNC_APP.azurewebsites.net/api/insights"

  step "BFF (imagem do Docker Hub)"
  if has az containerapp show -n bff -g "$RG"; then
    BFF=$(app_fqdn bff)
  else
    BFF=$(az containerapp create -n bff -g "$RG" --environment "$ACA_ENV" \
      --image "docker.io/$DOCKERHUB_USER/moviehub-bff:latest" --target-port 8080 --ingress external \
      --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 3 \
      --secrets insights-key="$FUNC_KEY" \
      --env-vars MOVIES_SERVICE_URL="https://$MS1" REVIEWS_SERVICE_URL="https://$MS2" \
        INSIGHTS_FUNCTION_URL="https://$FUNC_APP.azurewebsites.net/api/insights" INSIGHTS_FUNCTION_KEY=secretref:insights-key CORS_ORIGIN= \
      --query properties.configuration.ingress.fqdn -o tsv)
  fi
  save BFF_URL "https://$BFF"

  step "Static Web App (endereço do frontend, usado no CORS do gateway)"
  has az staticwebapp show -n "$SWA" -g "$RG" || az staticwebapp create -n "$SWA" -g "$RG" -l "$SWA_LOCATION" --sku Free -o none
  SWA_HOST=$(az staticwebapp show -n "$SWA" -g "$RG" --query defaultHostname -o tsv)
  save FRONTEND_URL "https://$SWA_HOST"

  step "Aguardando o BFF responder (o contêiner pode estar iniciando)"
  for i in $(seq 1 24); do
    curl -fsS -o /dev/null --max-time 20 "https://$BFF/openapi.json" && break
    sleep 5
  done

  step "API Management (Consumption) — pode levar alguns minutos"
  has az apim show -n "$APIM" -g "$RG" ||
    az apim create -n "$APIM" -g "$RG" -l "$LOCATION" --sku-name Consumption \
      --publisher-email "$APIM_PUBLISHER_EMAIL" --publisher-name MovieHub -o none
  az apim api import -g "$RG" --service-name "$APIM" --api-id moviehub --path moviehub --display-name "MovieHub BFF" \
    --specification-format OpenApiJson --specification-url "https://$BFF/openapi.json" --service-url "https://$BFF" \
    --protocols https --subscription-required true -o none

  SUB_ID=$(az account show --query id -o tsv)
  APIM_ID="/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.ApiManagement/service/$APIM"
  # corpos JSON em arquivo (@arquivo) para não depender das regras de aspas do shell (Windows/Git Bash)
  sed "s#__FRONTEND_ORIGIN__#https://$SWA_HOST#" "$HERE/apim-policy.xml" |
    node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.stringify({properties:{format:"rawxml",value:s}})))' > "$HERE/.deploy-policy.json"
  echo '{"properties":{"scope":"/apis/moviehub","displayName":"MovieHub Frontend","state":"active"}}' > "$HERE/.deploy-sub.json"
  az rest --method put --uri "https://management.azure.com$APIM_ID/apis/moviehub/policies/policy?api-version=2022-08-01" --body @"$HERE/.deploy-policy.json" -o none
  az rest --method put --uri "https://management.azure.com$APIM_ID/subscriptions/moviehub-frontend?api-version=2022-08-01" --body @"$HERE/.deploy-sub.json" -o none
  rm -f "$HERE/.deploy-policy.json" "$HERE/.deploy-sub.json"
  save GATEWAY_URL "https://$APIM.azure-api.net/moviehub"
  source "$STATE"
}

frontend() {
  source "$STATE"
  SUB_ID=$(az account show --query id -o tsv)
  APIM_ID="/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.ApiManagement/service/$APIM"
  APIM_KEY=$(az rest --method post --uri "https://management.azure.com$APIM_ID/subscriptions/moviehub-frontend/listSecrets?api-version=2022-08-01" --query primaryKey -o tsv)
  SWA_TOKEN=$(az staticwebapp secrets list -n "$SWA" -g "$RG" --query properties.apiKey -o tsv)

  step "Build do microfrontend apontando para o API Management"
  (cd "$ROOT/moviehub-frontend" && npm ci && VITE_BFF_URL="$GATEWAY_URL" VITE_APIM_SUBSCRIPTION_KEY="$APIM_KEY" npm run build)

  step "Publicação no Static Web Apps"
  (cd "$ROOT/moviehub-frontend" && npx --yes @azure/static-web-apps-cli@2 deploy ./dist --deployment-token "$SWA_TOKEN" --env production)
}

case "${1:-all}" in
  all) infra; frontend ;;
  frontend) frontend ;;
  *) echo "uso: $0 [all|frontend]"; exit 1 ;;
esac

step "Pronto"
cat "$STATE"
cat <<INFO

Swagger:
  BFF            $BFF_URL/docs
  MS Filmes      $MS1_URL/docs
  MS Avaliações  $MS2_URL/docs
Gateway (APIM):  $GATEWAY_URL/aggregated-data   (cabeçalho Ocp-Apim-Subscription-Key)
Frontend:        $FRONTEND_URL
INFO
