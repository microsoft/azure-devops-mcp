# Plan de Déploiement Azure - MCP Server Azure DevOps pour Copilot Studio

> **📊 Suivi des Progrès**: Voir [PHASES_PROGRESS.md](./PHASES_PROGRESS.md) pour le statut actuel de chaque phase et les tâches complétées.

## 📋 Vue d'ensemble

Ce plan détaille la transformation du serveur MCP Azure DevOps en service hébergé sur Azure, accessible via Copilot Studio avec authentification par utilisateur.

**Statut Actuel** (Octobre 10, 2025):

- ✅ **Phase 0**: Validation Initiale - COMPLÉTÉE
- ✅ **Phase 1**: HTTP Transport - COMPLÉTÉE
- ⏳ **Phase 2**: Conteneurisation Docker - PRÊTE À DÉMARRER

## 🎯 Objectifs

1. **Héberger le serveur MCP** sur Azure de manière permanente et fiable
2. **Authentifier l'agent Copilot Studio** auprès du serveur MCP
3. **Authentifier l'utilisateur final** via OAuth 2.0 pour accéder à Azure DevOps
4. **Préserver les permissions** de l'utilisateur sur les projets Azure DevOps
5. **Assurer la sécurité** et la conformité des données

---

## 🔍 Analyse des Recherches

### 1. Protocole d'Authentification MCP avec Copilot Studio

**Résultats clés:**

- Copilot Studio supporte **OAuth 2.0** et **API Key** pour l'authentification MCP
- Le transport **Streamable HTTP** est recommandé (SSE sera déprécié en août 2025)
- Flux d'authentification:
  - **Server URL** → URL du serveur MCP sur Azure
  - **OAuth 2.0 flow** → Authorization Code Grant pour déléguer l'identité utilisateur
  - **Token endpoint** → Pour échanger le code d'autorisation contre un access token

**⚠️ Clarification Importante : OAuth 2.0 vs Entra ID**

**OAuth 2.0** et **Microsoft Entra ID** ne sont PAS des alternatives :

- **OAuth 2.0** = Le **protocole d'autorisation** (comment faire l'échange de tokens)
- **Microsoft Entra ID** = Le **fournisseur d'identité** (qui authentifie et génère les tokens)

**Nous utilisons OAuth 2.0 AVEC Entra ID** :

- OAuth 2.0 définit les endpoints (`/authorize`, `/token`)
- Entra ID héberge ces endpoints et authentifie les utilisateurs
- Azure DevOps accepte **uniquement** les tokens Entra ID
- C'est la seule façon de préserver l'identité utilisateur jusqu'à Azure DevOps

**Configuration Copilot Studio:**

```yaml
# Le PROTOCOLE utilisé
Authentication Type: OAuth 2.0

# Les ENDPOINTS fournis par Microsoft Entra ID
Authorization URL: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
Token URL: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Refresh URL: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

# L'application ENREGISTRÉE dans Entra ID
Client ID: <Azure AD App Client ID>
Client Secret: <Azure AD App Client Secret>

# Le SCOPE pour accéder à Azure DevOps (ID de l'app Azure DevOps dans Entra ID)
Scopes: 499b84ac-1321-427f-aa17-267ca6975798/.default offline_access
```

### 2. Service Azure Recommandé: Azure Container Apps

**Pourquoi Container Apps?**

- ✅ **Serverless natif** avec scale-to-zero pour optimiser les coûts
- ✅ **Support Node.js** via containers personnalisés
- ✅ **VNet integration** pour sécurité réseau
- ✅ **Managed Identity** pour authentification Azure
- ✅ **Scaling automatique** basé sur la demande (KEDA)
- ✅ **Streamable HTTP/HTTPS** supporté nativement
- ✅ **OAuth 2.0 intégré** dans l'infrastructure

**Alternatives considérées:**

- ❌ **Azure Functions**: Moins flexible pour MCP (timeouts, limitations HTTP)
- ❌ **App Service**: Plus coûteux, toujours actif (pas de scale-to-zero)
- ✅ **Container Apps**: Idéal pour serveurs MCP avec trafic intermittent

### 3. Code Actuel - Points d'Attention

**Architecture actuelle:**

- **Transport**: `StdioServerTransport` (stdio) → **À REMPLACER** par HTTP/SSE
- **Authentification**: 3 modes (`interactive`, `azcli`, `env`)
  - `interactive`: OAuth avec MSAL (browser-based)
  - `azcli`: Utilise Azure CLI credentials
  - `env`: Utilise DefaultAzureCredential
- **Gestion tokens**: Refresh automatique via MSAL
- **Client Azure DevOps**: Créé avec bearer token

**Changements nécessaires:**

1. ⚠️ **Remplacer stdio par HTTP transport** (Streamable)
2. ⚠️ **Implémenter endpoint OAuth 2.0** pour Copilot Studio
3. ⚠️ **Gérer tokens utilisateur** (pas seulement le token du serveur)
4. ⚠️ **Ajouter validation de tokens** JWT depuis Azure AD
5. ✅ **Conserver la logique existante** des tools et prompts

---

## 📐 Architecture Cible

```
┌─────────────────┐
│ Copilot Studio  │
│     Agent       │
└────────┬────────┘
         │ OAuth 2.0
         │ (User Context)
         ▼
┌─────────────────────────────────┐
│  Azure Container App            │
│  ┌───────────────────────────┐  │
│  │ MCP Server (Node.js)      │  │
│  │ - Streamable HTTP         │  │
│  │ - OAuth 2.0 validation    │  │
│  │ - Token management        │  │
│  └───────────┬───────────────┘  │
│              │                   │
│  ┌───────────▼───────────────┐  │
│  │ Azure AD Integration      │  │
│  │ - User token validation   │  │
│  │ - Managed Identity        │  │
│  └───────────┬───────────────┘  │
└──────────────┼───────────────────┘
               │ Bearer Token
               │ (User Identity)
               ▼
┌─────────────────────────────────┐
│   Azure DevOps API              │
│   - User's projects only        │
│   - User's permissions enforced │
└─────────────────────────────────┘
```

---

## 🛠️ Plan de Développement (Phases)

### **Phase 0: Validation Initiale** (1-2 jours)

**Objectif:** Valider que le serveur MCP fonctionne correctement en local

#### Tâches:

1. **Tester le serveur localement avec stdio**

   ```bash
   npm install
   npm run build
   node dist/index.js <votre-org> --authentication interactive
   ```

2. **Tester avec un client MCP** (Claude Desktop ou VS Code)
   - Configurer `.mcp.json` local
   - Vérifier que les tools sont découverts
   - Tester quelques opérations (list projects, get work items)

3. **Documenter les capacités actuelles**
   - Liste des tools disponibles
   - Liste des prompts disponibles
   - Permissions Azure DevOps nécessaires

**Critères de succès:**

- ✅ Le serveur démarre sans erreur
- ✅ L'authentification interactive fonctionne
- ✅ Les tools répondent correctement
- ✅ Les données Azure DevOps sont accessibles

---

### **Phase 1: Transformation HTTP Transport** (3-5 jours)

**Objectif:** Remplacer stdio par Streamable HTTP pour compatibilité Copilot Studio

#### Tâches:

1. **Ajouter dépendances HTTP**

   ```bash
   npm install express @types/express
   npm install @modelcontextprotocol/sdk # version avec HTTP support
   ```

2. **Créer nouveau fichier `src/http-server.ts`**
   - Implémenter Express server
   - Configurer Streamable HTTP transport
   - Endpoints: `/mcp/discovery`, `/mcp/tools/**`, `/mcp/prompts/**`

3. **Implémenter authentification basique**
   - Endpoint `/oauth/authorize` (redirection Azure AD)
   - Endpoint `/oauth/callback` (réception du code)
   - Endpoint `/oauth/token` (échange de token)

4. **Modifier `src/index.ts`**
   - Détecter si en mode local (stdio) ou cloud (http)
   - Variable d'environnement `MCP_TRANSPORT=http|stdio`

5. **Tester localement avec HTTP**
   ```bash
   # Mode HTTP local
   MCP_TRANSPORT=http npm start
   curl http://localhost:3000/mcp/discovery
   ```

**Critères de succès:**

- ✅ Le serveur écoute sur HTTP (port 3000)
- ✅ Les endpoints MCP répondent en HTTP
- ✅ L'authentification OAuth fonctionne en local
- ✅ Le mode stdio est toujours fonctionnel

---

### **Phase 2: Conteneurisation** (2-3 jours)

**Objectif:** Créer une image Docker pour déploiement sur Azure

#### Tâches:

1. **Créer `Dockerfile`**

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY dist ./dist
   ENV MCP_TRANSPORT=http
   ENV PORT=8080
   EXPOSE 8080
   CMD ["node", "dist/index.js"]
   ```

2. **Créer `.dockerignore`**

   ```
   node_modules
   .env
   *.log
   dist
   test
   ```

3. **Tester l'image localement**

   ```bash
   docker build -t azure-devops-mcp:test .
   docker run -p 8080:8080 \
     -e AZURE_ORG=<votre-org> \
     -e AZURE_TENANT_ID=<tenant> \
     azure-devops-mcp:test
   ```

4. **Optimiser l'image**
   - Multi-stage build pour réduire la taille
   - Security scanning (npm audit)

**Critères de succès:**

- ✅ L'image Docker se construit sans erreur
- ✅ Le conteneur démarre et écoute sur le port 8080
- ✅ Les endpoints HTTP sont accessibles depuis l'hôte
- ✅ L'image est optimisée (<200MB)

---

### **Phase 3: Déploiement Azure Container Apps** (3-4 jours)

**Objectif:** Déployer le serveur MCP sur Azure Container Apps

#### Tâches:

1. **Créer Azure Container Registry (ACR)**

   ```bash
   az acr create --resource-group rg-mcp-devops \
     --name acrmcpdevops --sku Basic
   ```

2. **Pousser l'image vers ACR**

   ```bash
   az acr login --name acrmcpdevops
   docker tag azure-devops-mcp:test acrmcpdevops.azurecr.io/mcp-devops:v1
   docker push acrmcpdevops.azurecr.io/mcp-devops:v1
   ```

3. **Créer App Registration dans Azure AD**
   - Client ID et Client Secret pour OAuth 2.0
   - Redirect URI: `https://<app-name>.azurecontainerapps.io/oauth/callback`
   - API Permissions: `Azure DevOps` (499b84ac-1321-427f-aa17-267ca6975798/.default)
   - Enable "Allow public client flows" → NO (confidential client)

4. **Créer Container Apps Environment**

   ```bash
   az containerapp env create \
     --name env-mcp-devops \
     --resource-group rg-mcp-devops \
     --location eastus
   ```

5. **Déployer Container App**

   ```bash
   az containerapp create \
     --name mcp-azuredevops-server \
     --resource-group rg-mcp-devops \
     --environment env-mcp-devops \
     --image acrmcpdevops.azurecr.io/mcp-devops:v1 \
     --target-port 8080 \
     --ingress external \
     --min-replicas 0 \
     --max-replicas 10 \
     --env-vars \
       "AZURE_CLIENT_ID=<app-client-id>" \
       "AZURE_CLIENT_SECRET=<app-client-secret>" \
       "AZURE_TENANT_ID=<tenant-id>"
   ```

6. **Configurer Managed Identity** (optionnel, pour accès Key Vault)

   ```bash
   az containerapp identity assign \
     --name mcp-azuredevops-server \
     --resource-group rg-mcp-devops \
     --system-assigned
   ```

7. **Tester l'endpoint public**
   ```bash
   curl https://mcp-azuredevops-server.azurecontainerapps.io/mcp/discovery
   ```

**Critères de succès:**

- ✅ Le Container App est déployé et en cours d'exécution
- ✅ L'URL publique est accessible
- ✅ Le scaling fonctionne (scale-to-zero après inactivité)
- ✅ Les logs sont visibles dans Azure Portal

---

### **Phase 4: Intégration Copilot Studio** (2-3 jours)

**Objectif:** Connecter Copilot Studio au serveur MCP hébergé

#### Tâches:

1. **Ouvrir Copilot Studio** → Créer ou ouvrir un agent

2. **Ajouter le serveur MCP via l'assistant**
   - Aller à **Tools** → **Add a tool** → **New tool** → **Model Context Protocol**
   - **Server name**: Azure DevOps MCP Server
   - **Server description**: Access Azure DevOps projects, work items, pipelines, and repositories
   - **Server URL**: `https://mcp-azuredevops-server.azurecontainerapps.io`

3. **Configurer OAuth 2.0**
   - **Authentication**: OAuth 2.0
   - **Client ID**: `<app-client-id>`
   - **Client Secret**: `<app-client-secret>` (stocké comme secret)
   - **Authorization URL**: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
   - **Token URL**: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
   - **Refresh URL**: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
   - **Scopes**: `499b84ac-1321-427f-aa17-267ca6975798/.default offline_access`

4. **Tester la connexion**
   - Sélectionner **Add to agent**
   - Vérifier que les tools apparaissent dans la liste
   - Tester un prompt simple: "List my Azure DevOps projects"

5. **Tester l'authentification utilisateur**
   - Démarrer une conversation avec l'agent
   - Vérifier la redirection OAuth
   - Confirmer que l'agent accède aux projets de l'utilisateur connecté

**Critères de succès:**

- ✅ Copilot Studio se connecte au serveur MCP
- ✅ Les tools sont découverts automatiquement
- ✅ L'authentification OAuth fonctionne (consent screen)
- ✅ L'agent accède uniquement aux projets de l'utilisateur
- ✅ Les permissions Azure DevOps sont respectées

---

### **Phase 5: Tests et Validation** (2-3 jours)

**Objectif:** Valider le système end-to-end avec différents scénarios

#### Scénarios de test:

1. **Test multi-utilisateurs**
   - Utilisateur A avec projets X, Y
   - Utilisateur B avec projets Z
   - Vérifier l'isolation des données

2. **Test de permissions**
   - Utilisateur avec accès lecture seule
   - Utilisateur avec accès administrateur
   - Vérifier que les actions respectent les permissions

3. **Test de refresh token**
   - Laisser la session expirer (1h)
   - Vérifier que le refresh token fonctionne
   - Pas de nouvelle authentification nécessaire

4. **Test de performance**
   - 10 utilisateurs simultanés
   - Vérifier le scaling automatique
   - Mesurer les temps de réponse

5. **Test de sécurité**
   - Tentative d'accès sans token
   - Token invalide ou expiré
   - Vérifier les messages d'erreur appropriés

**Critères de succès:**

- ✅ Tous les scénarios passent sans erreur
- ✅ Les performances sont acceptables (<2s par requête)
- ✅ La sécurité est garantie (pas d'accès non autorisé)
- ✅ Les logs sont exploitables pour le debugging

---

### **Phase 6: Production et Documentation** (1-2 jours)

**Objectif:** Préparer pour la production et documenter

#### Tâches:

1. **Activer monitoring et alertes**
   - Azure Application Insights
   - Alertes sur erreurs HTTP 500
   - Alertes sur latence >5s

2. **Configurer CI/CD** (optionnel)
   - GitHub Actions pour build et push vers ACR
   - Déploiement automatique sur Container Apps

3. **Documentation utilisateur**
   - Comment obtenir les permissions Azure DevOps
   - Comment se connecter la première fois
   - FAQ et troubleshooting

4. **Documentation technique**
   - Architecture détaillée
   - Procédures de déploiement
   - Runbook pour incidents

**Critères de succès:**

- ✅ Monitoring actif et alertes configurées
- ✅ Documentation complète et accessible
- ✅ Procédures de support en place

---

## 📊 Estimation Globale

| Phase                      | Durée     | Complexité   | Priorité     |
| -------------------------- | --------- | ------------ | ------------ |
| Phase 0: Validation        | 1-2 jours | ⭐ Facile    | 🔴 Critique  |
| Phase 1: HTTP Transport    | 3-5 jours | ⭐⭐⭐ Moyen | 🔴 Critique  |
| Phase 2: Conteneurisation  | 2-3 jours | ⭐⭐ Facile  | 🔴 Critique  |
| Phase 3: Déploiement Azure | 3-4 jours | ⭐⭐ Moyen   | 🔴 Critique  |
| Phase 4: Copilot Studio    | 2-3 jours | ⭐⭐⭐ Moyen | 🔴 Critique  |
| Phase 5: Tests             | 2-3 jours | ⭐⭐ Moyen   | 🟡 Important |
| Phase 6: Production        | 1-2 jours | ⭐ Facile    | 🟡 Important |

**Total: 14-22 jours** (3-4 semaines)

---

## 🔐 Considérations de Sécurité

### Tokens et Secrets

- ✅ **Client Secret** stocké dans Azure Key Vault (référencé par Container App)
- ✅ **User tokens** jamais loggés ou persistés
- ✅ **HTTPS uniquement** (pas de HTTP en production)
- ✅ **Token rotation** automatique via refresh tokens

### Isolation des Données

- ✅ Chaque requête inclut le token utilisateur
- ✅ Azure DevOps API applique les permissions natives
- ✅ Pas de cache partagé entre utilisateurs
- ✅ Logs anonymisés (pas de PII)

### Conformité

- ✅ **GDPR**: Pas de stockage de données utilisateur
- ✅ **Azure Security**: Managed Identity, VNet, NSG si nécessaire
- ✅ **Audit**: Logs Azure Monitor pour toutes les requêtes

---

## 💰 Estimation des Coûts Azure

### Services utilisés:

1. **Azure Container Apps** (Consumption plan)
   - Scale-to-zero: gratuit quand inactif
   - Active: ~$0.000024/vCPU-second + $0.000004/GB-second
   - Estimation: **$10-30/mois** (usage modéré)

2. **Azure Container Registry** (Basic)
   - **$5/mois** (inclut 10 GB de stockage)

3. **Application Insights** (optionnel)
   - 5 GB/mois gratuit, puis $2.30/GB
   - Estimation: **$0-10/mois**

**Total estimé: $15-45/mois** pour un usage modéré (10-50 utilisateurs)

---

## 🎓 Ressources et Références

### Documentation officielle:

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Copilot Studio MCP Integration](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure DevOps OAuth 2.0](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth)

### Exemples de code:

- [MCP for Beginners](https://github.com/microsoft/mcp-for-beginners)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

---

## ✅ Checklist de Démarrage

Avant de commencer, assurez-vous d'avoir:

- [ ] Compte Azure avec permissions Contributor
- [ ] Organisation Azure DevOps avec accès administrateur
- [ ] Azure CLI installé localement
- [ ] Docker Desktop installé
- [ ] Node.js 20+ installé
- [ ] Accès à Copilot Studio
- [ ] Repository GitHub cloné localement

---

## 🚀 Prochaines Étapes & Suivi des Progrès

### 📊 Document de Suivi Principal

**Voir [PHASES_PROGRESS.md](./PHASES_PROGRESS.md)** pour:

- Statut en temps réel de chaque phase
- Tâches complétées et en cours
- Documentation de chaque phase
- Instructions pour démarrer la prochaine phase
- Historique complet du projet

### Prochaines Actions Immédiates (Phase 2)

Phase 2 est **PRÊTE À DÉMARRER**. Pour commencer:

1. **Lire le suivi**: Consulter [PHASES_PROGRESS.md](./PHASES_PROGRESS.md)
2. **Créer Dockerfile**: Suivre les instructions de la Phase 2 ci-dessus
3. **Tester localement**: Build et test du container
4. **Documenter**: Créer `PHASE2_COMPLETE.md` quand terminé
5. **Mettre à jour**: Modifier `PHASES_PROGRESS.md` avec les résultats

### Documents Complétés

- ✅ [CAPACITES_ACTUELLES.md](./CAPACITES_ACTUELLES.md) - Phase 0 completion
- ✅ [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) - Phase 1 completion
- ✅ [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) - Phase 0 & 1 validation

---

**Note pour les nouvelles sessions de travail:**  
Commencez toujours par lire [PHASES_PROGRESS.md](./PHASES_PROGRESS.md) pour comprendre l'état actuel du projet et les tâches à effectuer.

---

**Document créé le:** 2025-10-07  
**Version:** 1.0  
**Auteur:** GitHub Copilot + Équipe DevOps  
**Statut:** 🟢 Prêt pour exécution
