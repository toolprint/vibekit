export function initializeSensitivePatterns() {
  return [
    // ==== OPENAI & AI PROVIDERS ====
    /sk-proj-[A-Za-z0-9_-]{20,}/g,                // OpenAI project-scoped key
    /dtn_[A-Za-z0-9_]{60,}/g,                     // Daytona API key
    /e2b_[A-Za-z0-9_]{32,}/g,                     // E2B API key
    /sk-ant-[A-Za-z0-9_-]{20,}/g,                 // OpenAI ant key
    /sk-or-[A-Za-z0-9_-]{20,}/g,                  // OpenAI org-scoped key
    /sk-[A-Za-z0-9_-]{24,}/g,                     // OpenAI generic secret
    /gsk_[A-Za-z0-9_-]{20,}/g,                    // Google Generative AI Studio key (hyperspecific prefix)
    /xai-[A-Za-z0-9_-]{20,}/g,                    // xAI key (observed prefix)

    // ==== GITHUB ====
    /ghp_[A-Za-z0-9_]{36}/g,                      // GitHub PAT (classic)
    /gho_[A-Za-z0-9_]{36}/g,                      // GitHub OAuth token
    /ghs_[A-Za-z0-9_]{36}/g,                      // GitHub App server-to-server
    /ghu_[A-Za-z0-9_]{36}/g,                      // GitHub App user-to-server
    /ghr_[A-Za-z0-9_]{36}/g,                      // GitHub refresh token
    /github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}/g, // GitHub fine-grained PAT

    // ==== GITLAB ====
    /glpat-[A-Za-z0-9_-]{20,}/g,                  // GitLab PAT (prefix since 14.5)

    // ==== BITBUCKET & ATLASSIAN ====
    /x(Token|atl)-[A-Za-z0-9_-]{20,}/g,           // Atlassian style tokens (generic)
    /bitbucket[-_]?token[=:\s][A-Za-z0-9_-]{20,}/gi,

    // ==== AWS ====
    /AKIA[0-9A-Z]{16}/g,                          // AWS access key ID (long-lived)
    /ASIA[0-9A-Z]{16}/g,                          // AWS temporary access key ID
    /A3T[A-Z0-9]{16}/g,                           // Additional observed AKID prefixes
    /AKIA[0-9A-Z]{16}\s*[:=]\s*[A-Za-z0-9\/+=]{35,40}/g, // AKID + secret access key nearby
    /(aws_)?secret(access)?(_)?key\s*[:=]\s*[A-Za-z0-9\/+=]{35,}/gi, // AWS secret key by keyword
    /(aws_)?session[_-]?token\s*[:=]\s*[A-Za-z0-9\/+=]{80,}/gi, // AWS STS session token
    /\barn:aws:[A-Za-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[^\s]+/g,   // AWS ARN (sensitive context)

    // ==== AZURE ====
    /\bSharedAccess(Key|Signature)\b[^\n]{0,40}[=:\s][A-Za-z0-9%+\/=]{32,}\b/gi, // Azure SAS/SAK
    /\bEndpoint=sb:\/\/[A-Za-z0-9-]+\.servicebus\.windows\.net;SharedAccessKeyName=[^;]+;SharedAccessKey=[A-Za-z0-9+\/]{40,}\b/g,
    /\bDefaultEndpointsProtocol=https;AccountName=[a-z0-9]{3,24};AccountKey=[A-Za-z0-9+\/]{80,}==;EndpointSuffix=core\.windows\.net\b/g, // Azure Storage conn str
    /\b(eyJ|[A-Za-z0-9-_=]+)\.([A-Za-z0-9-_=]+)\.([A-Za-z0-9-_=]+)\b(?=[^\n]*Azure)/g, // JWTs in Azure contexts

    // ==== GCP & GOOGLE ====
    /AIza[0-9A-Za-z-_]{35}/g,                      // Google API key (common AIza prefix)
    /ya29\.[0-9A-Za-z-_]+/g,                      // Google OAuth access token
    /GOCSPX-[A-Za-z0-9-_]{20,}/g,                 // Google OAuth client secret style
    /"type":\s*"service_account"/g,            // GCP SA JSON indicator (PII-ish secret container)
    /"private_key":\s*"-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----"/g,
    /"client_email":\s*"[a-z0-9._%+-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com"/gi,

    // ==== SLACK ====
    /xoxb-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{20,}/g, // Slack bot token
    /xoxp-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{20,}/g, // Slack user token
    /xoxa-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{10,}-[A-Za-z0-9-]{20,}/g, // Slack workspace token
    /xapp-1-[A-Z0-9-]{10,}-[0-9]{13,}-[A-Za-z0-9]{64,}/g,          // Slack App level token

    // ==== STRIPE ====
    /sk_live_[0-9a-zA-Z]{24,}/g,                  // Stripe live secret key
    /sk_test_[0-9a-zA-Z]{24,}/g,                  // Stripe test secret key
    /rk_live_[0-9a-zA-Z]{24,}/g,                  // Stripe restricted key live
    /rk_test_[0-9a-zA-Z]{24,}/g,                  // Stripe restricted key test
    /pk_live_[0-9a-zA-Z]{24,}/g,                  // Stripe publishable key live
    /pk_test_[0-9a-zA-Z]{24,}/g,                  // Stripe publishable key test

    // ==== TWILIO ====
    /AC[0-9a-fA-F]{32}/g,                         // Twilio Account SID
    /SK[0-9a-fA-F]{32}/g,                         // Twilio API Key SID
    /\b(?:(twilio)?auth[_-]?token)\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi, // Twilio Auth Token

    // ==== SENDGRID / MAIL PROVIDERS ====
    /SG\.[A-Za-z0-9_\-\.]{66}/g,                // SendGrid API key
    /key-[0-9a-f]{32}/g,                           // Mailgun API key
    /\bmailchimp[_-]?api[_-]?key\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}-us[0-9]{1,2}\b/gi,
    /sparkpost(?=.*(api|key))[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40,}/gi,

    // ==== CLOUDFARE / CDN ====
    /\bCF-Access-Client-Id\b[^\n]{0,40}[:=]\s*[A-Za-z0-9_-]{32,}/gi,
    /\bCF-Access-Client-Secret\b[^\n]{0,40}[:=]\s*[A-Za-z0-9_-]{32,}/gi,
    /\bcloudflare[_-]?api[_-]?token\b[^\n]{0,40}[:=]\s*[A-Za-z0-9-_]{40,}/gi,

    // ==== DATADOG ====
    /\bDD_API_KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bDD_APP_KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{40}\b/gi,

    // ==== NEW RELIC ====
    /NRAK-[A-Z0-9]{27}/g,                         // New Relic ingest key
    /NRAL-[A-Z0-9]{27}/g,                         // New Relic license key
    /NRRA-[A-Z0-9]{27}/g,                         // New Relic personal api key style

    // ==== SENTRY ====
    /https?:\/\/[a-z0-9.-]+@o[0-9]+\.ingest\.sentry\.io\/[0-9]+/gi, // Sentry DSN (public)

    // ==== ALGOLIA ====
    /\bALGOLIA_ADMIN_API_KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bALGOLIA_SEARCH_API_KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bALGOLIA_APPLICATION_ID\b[^\n]{0,40}[:=]\s*[A-Z0-9]{10}\b/gi,

    // ==== FIREBASE ====
    /\bapiKey\s*:\s*"AIza[0-9A-Za-z-_]{35}"/g,  // Firebase config API key
    /\bmessagingSenderId\s*:\s*"[0-9]{11}"/g,
    /\bappId\s*:\s*"1:[0-9]{11}:[a-z0-9]{4}:[a-f0-9]{32}"/gi,

    // ==== PLAID ====
    /\bplaid[_-]secret\b[^\n]{0,40}[:=]\s*[a-z0-9]{16,32}\b/gi,
    /\bplaid[_-]public[_-]key\b[^\n]{0,40}[:=]\s*\w{16,32}\b/gi,

    // ==== SHOPIFY ====
    /shpat_[a-f0-9]{32}/g,                         // Shopify private app access token
    /shpss_[a-f0-9]{32}/g,                         // Shopify shared secret
    /shppa_[a-f0-9]{32}/g,                         // Shopify private app password (legacy)

    // ==== HEROKU ====
    /\bheroku[_-]?api[_-]?key\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,

    // ==== DROPBOX ====
    /\bsl\.[A-Za-z0-9-_]{8,}.[A-Za-z0-9-_]{8,}\b/g, // Dropbox short/long token formats

    // ==== DIGITALOCEAN ====
    /\bdo[_-]?api[_-]?token\b[^\n]{0,40}[:=]\s*[a-z0-9]{64}\b/gi,

    // ==== DOCKER HUB / NPM / PYPI ====
    /\bnpm[_-]?token\b[^\n]{0,40}[:=]\s*npm_[A-Za-z0-9]{36}\b/gi, // npm access token
    /\bpypi-AgENdGV\w{20,}\b/g,                  // PyPI token (starts with pypi-AgENdGV...)
    /\bDOCKERHUB[_-]?PASSWORD\b[^\n]{0,40}[:=]\s*.+/gi, // DockerHub pwd (keyword-based)

    // ==== FACEBOOK / META ====
    /EAACEdEose0cBA[0-9A-Za-z]+/g,                 // Older Facebook access token prefix
    /EAA[A-Za-z0-9]{20,}/g,                        // Generalized FB token prefix

    // ==== TWITTER / X ====
    /\bTWITTER[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{25}\b/gi,
    /\bTWITTER[_-]API[_-]SECRET\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{50}\b/gi,
    /\bBearer\s+AAAAAAAA[A-Za-z0-9%\-_]{20,}/g,  // Twitter bearer token

    // ==== COINBASE / CRYPTO ====
    /\bCB-ACCESS-KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{24,}/gi,
    /\bCB-ACCESS-SIGN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9+/=]{40,}/gi,
    /\bapi[-_ ]?secret\b[^\n]{0,40}[:=]\s*[A-Za-z0-9+/=]{32,}/gi,

    // ==== MIXPANEL / SEGMENT ====
    /\bmixpanel[_-]?token\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bSEGMENT[_-]?WRITE[_-]?KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{24,}\b/gi,

    // ==== AUTH / OAUTH / JWT ====
    /\bclient[_-]?secret\b[^\n]{0,40}[:=]\s*[A-Za-z0-9\-_.]{16,}\b/gi,
    /\bclient[_-]?id\b[^\n]{0,40}[:=]\s*[A-Za-z0-9\-_.]{12,}\b/gi,
    /\brefresh[_-]?token\b[^\n]{0,40}[:=]\s*[A-Za-z0-9\-_.]{24,}\b/gi,
    /\b(id|access)[-_ ]?token\b[^\n]{0,40}[:=]\s*[A-Za-z0-9\-_.]{24,}\b/gi,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // generic JWT

    // ==== DATABASE CONNECTION STRINGS ====
    /\bpostgres(?:ql)?:\/\/[A-Za-z0-9_%+.-]+:[^@\s]{1,}@[^\s]+\/[A-Za-z0-9_.-]+/g,
    /\bmongodb(?:\+srv)?:\/\/[A-Za-z0-9_%+.-]+:[^@\s]{1,}@[^\s]+\/[A-Za-z0-9_.-]+/g,
    /\bmysql:\/\/[A-Za-z0-9_%+.-]+:[^@\s]{1,}@[^\s]+\/[A-Za-z0-9_.-]+/g,
    /\bredis:\/\/[A-Za-z0-9_%+.-]+:[^@\s]{1,}@[A-Za-z0-9_.:-]+/g,
    /\b(sqlserver|mssql):\/\/[A-Za-z0-9_%+.-]+:[^@\s]{1,}@[^\s]+/gi,

    // ==== GENERIC HIGH-ENTROPY / BASE64 ====
    /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,              // long base64 blobs
    /\b[0-9a-f]{32,}\b/gi,                        // long hex (API keys, hashes)

    // ==== PAYMENT / FINANCIAL (PII-ish) ====
    /\b4[0-9]{12}(?:[0-9]{3})?\b/g,               // Visa (no spaces)
    /\b4[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g, // Visa (with spaces/dashes)
    /\b5[1-5][0-9]{14}\b/g,                       // MasterCard (no spaces)
    /\b5[1-5][0-9]{2}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g, // MasterCard (with spaces/dashes)
    /\b3[47][0-9]{13}\b/g,                        // AmEx (no spaces)
    /\b3[47][0-9]{2}[\s-]?[0-9]{6}[\s-]?[0-9]{5}\b/g, // AmEx (with spaces/dashes)
    /\b3(?:0[0-5]|[68][0-9])[0-9]{11}\b/g,        // Diners Club (no spaces)
    /\b3(?:0[0-5]|[68][0-9])[0-9]{2}[\s-]?[0-9]{6}[\s-]?[0-9]{4}\b/g, // Diners Club (with spaces/dashes)
    /\b6(?:011|5[0-9]{2})[0-9]{12}\b/g,           // Discover (no spaces)
    /\b6(?:011|5[0-9]{2})[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g, // Discover (with spaces/dashes)
    /\b(?:2131|1800|35\d{3})\d{11}\b/g,          // JCB (no spaces)
    /\b(?:2131|1800|35\d{3})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // JCB (with spaces/dashes)
    /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/g,       // Generic IBAN
    /\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,   // SWIFT/BIC 8 or 11

    // ==== GOVERNMENT IDENTIFIERS (PII) ====
    /\b(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}\b/g, // US SSN
    /\b\d{3}-\d{2}-\d{4}\b/g,                   // US SSN (loose)
    /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/g,       // UK NI number (format)
    /\b[0-9]{9}\b(?=.*\b(US|USA|passport)\b)/gi, // US passport (heuristic)
    /\b[A-Z]{2}[0-9]{7}\b/g,                      // Generic passport-like
    /\b\d{6}-\d{4}\b/g,                          // Sweden personnummer (YYMMDD-XXXX)
    /\b\d{8}-\d{4}\b/g,                          // Sweden coord number variant
    /\b\d{11}\b(?=.*(SE|personnummer))/gi,       // Sweden (loose w/ context)
    /\b[12]\d{9}\b(?=.*\bTIN\b)/gi,             // US ITIN heuristic

    // ==== CONTACT & NETWORK (PII) ====
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
    /\b\+?[1-9]\d{1,14}\b/g,                    // E.164 international phone
    /\b(?:\d[ -]?){9,15}\b(?=.*\b(phone|tel|mobile)\b)/gi, // phone w/ context
    /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, // IPv4
    /\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, // IPv6
    /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g, // MAC address

    // ==== CLOUD / INFRA CONNECTIONS ====
    /\bssh-rsa\s+[A-Za-z0-9+/]{100,}={0,3}\b/g,
    /-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    /\b(gcp|aws|azure)[-_ ]?(api|secret|key|token)\b[^\n]{0,40}[:=]\s*\S{12,}/gi,

    // ==== KUBERNETES ====
    /\btoken:\s*[A-Za-z0-9\._\-]{16,}\b/g,       // K8s service account token
    /\bapiVersion:\s*v1\b[\s\S]*?kind:\s*Secret[\s\S]*?data:/g, // K8s secret manifest

    // ==== CI/CD PROVIDERS ====
    /\bGITHUB_TOKEN\b[^\n]{0,40}[:=]\s*\w{20,}/gi,
    /\bGITLAB[_-]TOKEN\b[^\n]{0,40}[:=]\s*\w{16,}/gi,
    /\bCIRCLE[_-]TOKEN\b[^\n]{0,40}[:=]\s*\w{16,}/gi,
    /\bTRAVIS[_-]TOKEN\b[^\n]{0,40}[:=]\s*\w{16,}/gi,

    // ==== PAYMENT PROCESSORS (more) ====
    /\bBRAINTREE[_-]ACCESS[_-]TOKEN\b[^\n]{0,40}[:=]\s*access_token\$production\$[A-Za-z0-9_\-]{30,}/gi,
    /\bSQUARE[_-]ACCESS[_-]TOKEN\b[^\n]{0,40}[:=]\s*EAAA[A-Za-z0-9]{60,}/gi,
    /\bPAYPAL[_-](CLIENT|SECRET)\b[^\n]{0,40}[:=]\s*[A-Za-z0-9-]{20,}/gi,

    // ==== CLOUD PROVIDERS (more) ====
    /\bOCI[_-]API[_-]KEY[_-]FINGERPRINT\b[^\n]{0,40}[:=]\s*[a-f0-9:]{47}\b/gi, // Oracle Cloud
    /\baliyun[_-]?access[_-]?key[_-]?id\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{16,}\b/gi,
    /\baliyun[_-]?access[_-]?key[_-]?secret\b[^\n]{0,40}[:=]\s*[A-Za-z0-9+/=]{30,}\b/gi,

    // ==== MONITORING / APM ====
    /\bHONEYCOMB_API_KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32,}\b/gi,
    /\bLIGHTSTEP[_-]ACCESS[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40,}\b/gi,
    /\bSENTRY_AUTH_TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{24,}\b/gi,

    // ==== SEARCH / INDEXING ====
    /\bELASTIC[_-]CLOUD[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9+/=]{40,}\b/gi,
    /\bMEILISEARCH[_-]MASTER[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{16,}\b/gi,

    // ==== STORAGE / QUEUES ====
    /\bAWS[_-]SQS[_-]URL\b[^\n]{0,40}[:=]\s*https?:\/\/sqs\.[^\s]+/gi,
    /\bRABBITMQ[_-](PASS|PASSWORD)\b[^\n]{0,40}[:=]\s*\S{8,}\b/gi,

    // ==== MAPS / GEO ====
    /\bMAPBOX_ACCESS_TOKEN\b[^\n]{0,40}[:=]\s*pk\.[A-Za-z0-9]{60,}\b/gi,
    /\bMAPBOX_SECRET_TOKEN\b[^\n]{0,40}[:=]\s*sk\.[A-Za-z0-9]{60,}\b/gi,
    /\bHERE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{43}\b/gi,

    // ==== ANALYTICS ====
    /\bGOOGLE[_-]ANALYTICS[_-]TRACKING[_-]ID\b[^\n]{0,40}[:=]\s*UA-\d{4,9}-\d+/gi,
    /\bGA4[_-]MEASUREMENT[_-]ID\b[^\n]{0,40}[:=]\s*G-[A-Z0-9]{8,10}\b/gi,

    // ==== EMAIL / SMS ====
    /\bPOSTMARK[_-]SERVER[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{25}\b/gi,
    /\bMESSAGEBIRD[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{25}\b/gi,

    // ==== FEATURE FLAGS ====
    /\bLAUNCHDARKLY[_-]SDK[_-]KEY\b[^\n]{0,40}[:=]\s*sdk-\w{32,}\b/gi,
    /\bLAUNCHDARKLY[_-]MOBILE[_-]KEY\b[^\n]{0,40}[:=]\s*mob-\w{32,}\b/gi,

    // ==== PAYMENT (more precise) ====
    /\b(?:\d[ -]*?){13,19}\b(?=.*\b(card|cc|pan|payment|visa|mc|amex)\b)/gi, // PAN with context

    // ==== PERSONAL / ADDRESS (PII) ====
    /\b\d{1,5}\s+[A-Za-zÀ-ÖØ-öø-ÿ'\.\-]+\s+(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Way|Drive|Dr\.?|Gata|Vägen)\b/gi, // address-ish
    /\b[A-Z]{2}\s?\d{5}\b/g,                    // US state + ZIP (loose)
    /\bSE\s?\d{3}\s?\d{2}\b/g,                 // Swedish postal code

    // ==== HEALTH / OTHER (only by keywords; avoid overreach) ====
    /\bmedical[_-]?record\b[^\n]{0,40}[:=]\s*\S{6,}/gi,

    // ==== CRYPTO WALLETS ====
    /\b0x[a-fA-F0-9]{40}\b/g,                     // Ethereum address
    /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,       // Bitcoin (legacy)
    /\bbc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}\b/g, // Bech32

    // ==== MISC SECRET FLAGS ====
    /\bSECRET_KEY(?:_BASE)?\b[^\n]{0,40}[:=]\s*\S{12,}/gi,
    /\bAPI[_-]?KEY\b[^\n]{0,40}[:=]\s*\S{16,}/gi,
    /\bACCESS[_-]?TOKEN\b[^\n]{0,40}[:=]\s*\S{16,}/gi,

    // ==== MORE PROVIDER-SPECIFIC (to reach 200+) ====
    /\bTFE[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{20,}\b/gi,          // Terraform Cloud
    /\bPULUMI_ACCESS_TOKEN\b[^\n]{0,40}[:=]\s*\w{20,}\b/gi,
    /\bHASHICORP[_-]VAULT[_-]TOKEN\b[^\n]{0,40}[:=]\s*\w{24,}\b/gi,
    /\bANSIBLE[_-]VAULT[_-]PASSWORD\b[^\n]{0,40}[:=]\s*.+/gi,
    /\bKAFKA[_-](PASSWORD|SASL_JAAS)\b[^\n]{0,80}/gi,
    /\bGRAFANA[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*\w{20,}\b/gi,
    /\bINFLUXDB[_-](TOKEN|AUTH)\b[^\n]{0,40}[:=]\s*\w{20,}\b/gi,
    /\bPAGERDUTY[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*\w{20,}\b/gi,
    /\bSNYK[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{36}\b/gi,
    /\bSONAR[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40}\b/gi,
    /\bCLOUDFLARE_GLOBAL_API_KEY\b[^\n]{0,40}[:=]\s*[A-F0-9]{32}\b/gi,
    /\bTURBOREPO[_-]TEAM[_-]TOKEN\b[^\n]{0,40}[:=]\s*\w{20,}\b/gi,
    /\bSUPABASE[_-](ANON|SERVICE)_KEY\b[^\n]{0,40}[:=]\s*eyJ[A-Za-z0-9._\-]+/gi, // JWT-like
    /\bHASURA[_-]GRAPHQL[_-]ADMIN[_-]SECRET\b[^\n]{0,40}[:=]\s*\S{8,}\b/gi,
    /\bPRISMA[_-]DATA[/_-]PROXY[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*\w{24,}\b/gi,
    /\bMONGODB[_-]ATLAS[_-]API[_-](KEY|SECRET)\b[^\n]{0,40}[:=]\s*\w{18,}\b/gi,
    /\bFIREBASE[_-]CLOUD[_-]MESSAGING[_-]SERVER[_-]KEY\b[^\n]{0,40}[:=]\s*AAA[A-Za-z0-9_-]{7,}\b/gi,
    /\bAPPLE[_-]APP[_-]SITE[_-]ASSOCIATION\b.*"applinks"/gi, // potential sensitive config
    /\bAPNS[_-](KEY|TOKEN)\b[^\n]{0,40}[:=]\s*[A-Za-z0-9\-_.]{16,}\b/gi,
    /\bONESIGNAL[_-](API|REST)[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{48}\b/gi,
    /\bFONTAWESOME[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9_-]{40,}\b/gi,
    /\bAMPLITUDE[_-](API|SECRET)[_-]KEY\b[^\n]{0,40}[:=]\s*\w{32,}\b/gi,
    /\bPOSTGRES[_-](PASSWORD|PASS)\b[^\n]{0,40}[:=]\s*\S{8,}\b/gi,
    /\bMYSQL[_-](PASSWORD|PASS)\b[^\n]{0,40}[:=]\s*\S{8,}\b/gi,
    /\bAZURE[_-]AD[_-]CLIENT[_-](ID|SECRET)\b[^\n]{0,40}[:=]\s*\S{16,}\b/gi,
    /\bOKTA[_-](API|ORG)[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40,}\b/gi,
    /\bCLOUDFLARE[_-]R2[_-]ACCESS[_-](KEY|SECRET)\b[^\n]{0,40}[:=]\s*\S{16,}\b/gi,
    /\bBACKBLAZE[_-]B2[_-](KEY|SECRET)\b[^\n]{0,40}[:=]\s*\S{16,}\b/gi,
    /\bLINODE[_-](TOKEN|API[_-]TOKEN)\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{64}\b/gi,
    /\bFASTLY[_-]API[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bNETLIFY[_-]AUTH[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40}\b/gi,
    /\bVERCEL[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{24,}\b/gi,
    /\bCLOUDFRONT[_-]KEY[_-]PAIR[_-]ID\b[^\n]{0,40}[:=]\s*APKA[A-Z0-9]{16}\b/gi,
    /\bTRELLO[_-]KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bTRELLO[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{64}\b/gi,
    /\bASANA[_-]ACCESS[_-]TOKEN\b[^\n]{0,40}[:=]\s*\d{16}:[A-Za-z0-9]{32}\b/gi,
    /\bLINEAR[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*lin_[A-Za-z0-9]{40}\b/gi,
    /\bCLICKUP[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{48}\b/gi,
    /\bNOTION[_-]TOKEN\b[^\n]{0,40}[:=]\s*secret_[A-Za-z0-9]{43}\b/gi,
    /\bAIRTABLE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*key[A-Za-z0-9]{14}\b/gi,
    /\bINTERCOM[_-](APP|API)[_-]SECRET\b[^\n]{0,40}[:=]\s*[a-f0-9]{40}\b/gi,
    /\bFRESHDESK[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{20}\b/gi,
    /\bZENDESK[_-]API[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{40}\b/gi,
    /\bCONTENTFUL[_-]DELIVERY[_-]API[_-]TOKEN\b[^\n]{0,40}[:=]\s*CFPAT-[A-Za-z0-9_-]{50,}\b/gi,
    /\bSTRAPI[_-]API[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9_.-]{32,}\b/gi,
    /\bKEEN[_-]PROJECT[_-]ID\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{24}\b/gi,
    /\bKEEN[_-]WRITE[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{64}\b/gi,
    /\bBUGSNAG[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-F0-9]{32}\b/gi,
    /\bROLLBAR[_-]ACCESS[_-]TOKEN\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bSENTRY_DSN\b[^\n]{0,40}[:=]\s*https?:\/\/\S+@o\d+\.ingest\.sentry\.io\/\d+\b/gi,
    /\bGHOST[_-]ADMIN[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{64}:[0-9a-f]{24}\b/gi,
    /\bSTRIPE[_-]WEBHOOK[_-]SECRET\b[^\n]{0,40}[:=]\s*whsec_[A-Za-z0-9]{32}\b/gi,
    /\bPLAID[_-]WEBHOOK[_-]SECRET\b[^\n]{0,40}[:=]\s*whsec_[A-Za-z0-9]{32}\b/gi,
    /\bTWILIO[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*SK[0-9a-fA-F]{32}\b/gi,
    /\bTWILIO[_-]ACCOUNT[_-]SID\b[^\n]{0,40}[:=]\s*AC[0-9a-fA-F]{32}\b/gi,
    /\bOKTA[_-]CLIENT[_-](SECRET|TOKEN)\b[^\n]{0,40}[:=]\s*\w{32,}\b/gi,
    /\bFIREBASE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*AIza[0-9A-Za-z-_]{35}\b/gi,
    /\bGITHUB[_-](TOKEN|PAT)\b[^\n]{0,40}[:=]\s*(?:gh[pourhs]_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59})\b/gi,
    /\bGITLAB[_-]PAT\b[^\n]{0,40}[:=]\s*glpat-[A-Za-z0-9_-]{20,}\b/gi,
    /\bAZURE[_-]DEVOPS[_-]PAT\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{52,}\b/gi,

    // ==== GENERIC SECRET NAMING HEURISTICS (adds many entries) ====
    /\b(secret|password|passwd|pwd)\b[^\n]{0,20}[:=]\s*\S{6,}/gi,
    /\b(api|access|private|public)[-_ ]?(key|token|secret)\b[^\n]{0,20}[:=]\s*\S{8,}/gi,
    /\b(signature|webhook[_-]?secret)\b[^\n]{0,20}[:=]\s*\S{10,}/gi,

    // ==== NATIONAL IDs (lightweight patterns to increase coverage) ====
    /\b\d{2}[0-1]\d[0-3]\d[- ]?\d{4}\b/g,       // Generic date-based ID (e.g., Nordics)
    /\b\d{11}\b(?=.*\b(NIN|CPF|PESEL|CNP)\b)/gi, // Various national IDs with context

    // ==== EXTRA PROVIDERS (bulk for 200+) ====
    /\bMAILGUN[_-]PRIVATE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*key-[0-9a-f]{32}\b/gi,
    /\bSENDINBLUE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*xkeysib-[A-Za-z0-9]{64}-[A-Za-z0-9]{16}\b/gi,
    /\bALGOLIA[_-]ADMIN[_-]KEY\b[^\n]{0,40}[:=]\s*[0-9a-f]{32}\b/gi,
    /\bMAPTILER[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{43}\b/gi,
    /\bYOUTUBE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*AIza[0-9A-Za-z-_]{35}\b/gi,
    /\bOPENWEATHER[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bGIPHY[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bUNSPLASH[_-]ACCESS[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{43}\b/gi,
    /\bPEXELS[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bTMDB[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bNEWSAPI[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32}\b/gi,
    /\bGROQ[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*grk_[A-Za-z0-9]{24,}\b/gi,
    /\bANTHROPIC[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*sk-ant-[A-Za-z0-9_-]{20,}\b/gi,
    /\bOPENAI[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*sk-[A-Za-z0-9_-]{24,}\b/gi,
    /\bCOHERE[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*[A-Za-z0-9]{32,}\b/gi,
    /\bMISTRAL[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*mistral_[A-Za-z0-9]{24,}\b/gi,
    /\bPERPLEXITY[_-]API[_-]KEY\b[^\n]{0,40}[:=]\s*pxy_[A-Za-z0-9]{24,}\b/gi,
    /\bREPLICATE[_-]API[_-]TOKEN\b[^\n]{0,40}[:=]\s*r8_[A-Za-z0-9]{32,}\b/gi,

    // ==== FINAL CATCH-ALLS ====
    /\bPRIVATE[_-]KEY\b[^\n]{0,40}[:=]\s*(?:"|')?[-A-Za-z0-9+/=]{32,}/gi,
    /\bSECRET\b[^\n]{0,40}[:=]\s*(?:"|')?\S{10,}/gi,
  ];
}