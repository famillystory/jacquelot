Added to token: dans User/Profile/tokens
cloud flare pages: edit


CLOUDFLARE\_API\_TOKEN

CLOUDFLARE\_ACCOUNT\_ID


set CLOUDFLARE_API_TOKEN=<created with Edit Cloudflare Workers template>

//cloudflare token check:
curl.exe "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer %CLOUDFLARE_API_TOKEN%"
{"success":false,"errors":[{"code":1000,"message":"Invalid API Token"}],"messages":[],"result":null}


npx wrangler secret put JACQ_USER
npx wrangler secret put JACQ_PASS


Build/Workers \& Pages/jacquelot/Production/Settings/Build/Build configuration/ :

deploy command: npx wrangler pages deploy . --project-name=jacquelot



       npx wrangler pages deploy . --project-name=jacquelot --branch=$CF\_PAGES\_BRANCH



pour lister les projets disponibles: npx wrangler pages project list



npx wrangler whoami

npx wrangler pages project list --account-id c338275801f7741b7ef7977e1d704cc7



en local:

## créer le projet (une seule fois)

npx wrangler pages project create mon-site --production-branch main


## déployer : dossier statique + dossier functions détecté automatiquement

npx wrangler pages deploy . --project-name mon-site --branch main


