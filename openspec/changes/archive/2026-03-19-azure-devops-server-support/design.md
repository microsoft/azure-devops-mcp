## Context

L'extension MCP Azure DevOps est actuellement optimisée pour Azure DevOps Services (Cloud) avec une URL fixe (`dev.azure.com`) et une version d'API figée dans le code (`src/utils.ts`). Pour supporter Azure DevOps Server (on-premise), nous devons introduire de la flexibilité dans la configuration de l'URL de base et de la version de l'API.

## Goals / Non-Goals

**Goals:**

- Permettre à l'utilisateur de spécifier une URL complète pour l'instance Azure DevOps (ex: `https://tfs.contoso.com/tfs/DefaultCollection`).
- Permettre de configurer la version de l'API cible via la ligne de commande ou la configuration MCP.
- Supporter l'authentification par PAT (Personal Access Token) pour les instances on-premise.

**Non-Goals:**

- Support de l'authentification NTLM ou Kerberos (le PAT est privilégié pour sa simplicité et sa sécurité dans un contexte MCP).
- Changement de la structure des outils MCP existants (ils doivent rester compatibles).

## Decisions

### 1. Nouveaux paramètres de ligne de commande

Nous ajouterons deux nouveaux paramètres optionnels dans `src/index.ts` :

- `--url` : L'URL de base complète de l'organisation ou de la collection (ex: `https://tfs.contoso.com/tfs/DefaultCollection`). Si ce paramètre est présent, il prime sur la construction par défaut `https://dev.azure.com/{org}`.
- `--api-version` : La version de l'API à utiliser pour les appels REST (ex: `6.0`, `7.1`). Si non spécifié, la valeur par défaut reste `7.2-preview.1`.

### 2. Evolution de `src/auth.ts`

Le type d'authentification `envvar` (utilisant `ADO_MCP_AUTH_TOKEN`) sera conservé et recommandé pour Azure DevOps Server. Nous pourrions ajouter un alias `pat` pour plus de clarté.

### 3. Centralisation de la configuration de l'API

Actuellement, `src/utils.ts` exporte des constantes en dur :

```typescript
export const apiVersion = "7.2-preview.1";
```

Nous allons modifier cela pour que `apiVersion` puisse être injecté ou lu depuis une variable globale initialisée au démarrage dans `src/index.ts`. Les outils dans `src/tools/*.ts` devront utiliser cette version dynamique.

### 4. Construction dynamique des URLs

La logique de construction des URLs dans les outils (ex: `src/tools/pipelines.ts`) devra être mise à jour pour utiliser l'URL de base configurée au lieu de la construire systématiquement avec `dev.azure.com`.

## Risks / Trade-offs

- **[Risque]** Incompatibilité des versions d'API entre Server 2022 et Services.
  - **Atténuation** : Permettre à l'utilisateur de forcer la version via `--api-version`.
- **[Risque]** Complexité de configuration pour l'utilisateur.
  - **Atténuation** : Garder les valeurs par défaut actuelles pour que l'expérience "Cloud" reste inchangée.
- **[Trade-off]** Utilisation de `fetch` natif vs client SDK.
  - **Décision** : Continuer d'utiliser `fetch` pour la plupart des outils (comme c'est déjà le cas) pour une meilleure maîtrise des versions d'API envoyées dans la query string.
