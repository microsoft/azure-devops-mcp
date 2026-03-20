## Why

Actuellement, l'extension MCP Azure DevOps ne supporte que les instances Azure DevOps Services (Cloud) avec des versions d'API fixées en dur. De nombreux utilisateurs travaillent avec des instances Azure DevOps Server (on-premise) qui nécessitent une configuration d'URL personnalisée, des méthodes d'authentification spécifiques (PAT), et des versions d'API compatibles avec leur version de serveur (ex: Azure DevOps Server 2022).

## What Changes

- Ajout d'une option de configuration pour spécifier l'URL de base de l'instance Azure DevOps (ex: `https://tfs.contoso.com/tfs`).
- Support de l'authentification par Personal Access Token (PAT) pour les instances on-premise.
- Possibilité de spécifier la version cible de l'API Azure DevOps via la configuration.
- Conservation de la compatibilité avec Azure DevOps Services (Cloud).
- Mise à jour de la logique de construction des URLs pour supporter à la fois `dev.azure.com/{org}` et les URLs personnalisées.

## Capabilities

### New Capabilities

- `azure-devops-server-support`: Gestion de la connexion et de l'authentification aux instances self-hosted d'Azure DevOps Server 2022.
- `api-versioning`: Capacité à configurer et utiliser une version spécifique de l'API Azure DevOps.

### Modified Capabilities

- `auth`: Extension de la logique d'authentification pour supporter les PATs liés à des URLs personnalisées.

## Impact

- `src/index.ts`: Ajout de nouveaux paramètres CLI/options (`--url`, `--api-version`).
- `src/auth.ts`: Nouvelle logique d'authentification PAT.
- `src/utils.ts` & `src/shared/domains.ts`: Centralisation et injection de la version d'API.
- `src/tools/*.ts`: Mise à jour des appels `fetch` pour utiliser l'URL de base et la version d'API configurées.
- Configuration de l'utilisateur (mcp configuration).
