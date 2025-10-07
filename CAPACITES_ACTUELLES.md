# Capacités Actuelles du Serveur MCP Azure DevOps

**Date de documentation:** 2025-10-07  
**Version du serveur:** 2.2.0  
**Organisation testée:** nexusinno  
**Mode d'authentification:** Interactive (OAuth)

---

## 📋 Vue d'Ensemble

Le serveur MCP Azure DevOps expose **actuellement 50+ tools** et **3 prompts** répartis en **9 domaines** fonctionnels.

### Domaines Disponibles

| Domaine               | Description                                  | Tools |
| --------------------- | -------------------------------------------- | ----- |
| **CORE**              | Gestion des projets, équipes et identités    | 3     |
| **WORK_ITEMS**        | Gestion des work items (bugs, tâches, etc.)  | 7+    |
| **PIPELINES**         | Gestion des builds et pipelines CI/CD        | 11    |
| **REPOSITORIES**      | Gestion du code source et pull requests      | 19    |
| **WORK**              | Gestion des itérations et sprints            | 4+    |
| **WIKI**              | Gestion des wikis et documentation           | 3+    |
| **TEST_PLANS**        | Gestion des plans de test et cas de test     | 5+    |
| **SEARCH**            | Recherche dans le code, wikis et work items  | 3     |
| **ADVANCED_SECURITY** | Alertes de sécurité GitHub Advanced Security | 2     |

---

## 🔧 Tools par Domaine

### 1. CORE (Projets et Équipes)

| Tool Name                 | Description                              | Paramètres Principaux        |
| ------------------------- | ---------------------------------------- | ---------------------------- |
| `core_list_projects`      | Liste tous les projets de l'organisation | `stateFilter`, `top`, `skip` |
| `core_list_project_teams` | Liste les équipes d'un projet            | `project`, `mine`, `top`     |
| `core_get_identity_ids`   | Récupère les IDs d'identité par filtre   | `searchFilter`               |

**Exemple d'utilisation:**

```json
{
  "name": "core_list_projects",
  "arguments": {
    "stateFilter": "wellFormed",
    "top": 100
  }
}
```

---

### 2. PIPELINES (Builds et CI/CD)

| Tool Name                                  | Description                            | Paramètres Principaux                    |
| ------------------------------------------ | -------------------------------------- | ---------------------------------------- |
| `pipelines_get_build_definitions`          | Liste les définitions de build         | `project`, `name`, `top`                 |
| `pipelines_get_builds`                     | Liste les builds                       | `project`, `definitions`, `statusFilter` |
| `pipelines_get_build_log`                  | Récupère les logs d'un build           | `project`, `buildId`                     |
| `pipelines_get_build_log_by_id`            | Récupère un log spécifique par ID      | `project`, `buildId`, `logId`            |
| `pipelines_get_build_changes`              | Liste les changements d'un build       | `project`, `buildId`                     |
| `pipelines_get_build_definition_revisions` | Historique des révisions de définition | `project`, `definitionId`                |
| `pipelines_run_pipeline`                   | Déclenche un pipeline                  | `project`, `pipelineId`, `branch`        |
| `pipelines_get_run`                        | Détails d'une exécution de pipeline    | `project`, `pipelineId`, `runId`         |
| `pipelines_list_runs`                      | Liste les exécutions de pipeline       | `project`, `pipelineId`                  |
| `pipelines_update_build_stage`             | Met à jour l'état d'un stage           | `project`, `buildId`, `stage`, `state`   |

**Exemple d'utilisation:**

```json
{
  "name": "pipelines_get_builds",
  "arguments": {
    "project": "MyProject",
    "statusFilter": "completed",
    "top": 10
  }
}
```

---

### 3. REPOSITORIES (Code Source et PRs)

| Tool Name                               | Description                           | Paramètres Principaux                                            |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `repositories_list_repositories`        | Liste les repositories d'un projet    | `project`                                                        |
| `repositories_get_branches`             | Liste les branches d'un repository    | `project`, `repository`                                          |
| `repositories_get_pull_requests`        | Liste les pull requests               | `project`, `repository`, `status`                                |
| `repositories_get_pull_request`         | Détails d'une pull request            | `project`, `repository`, `pullRequestId`                         |
| `repositories_create_pull_request`      | Crée une pull request                 | `project`, `repository`, `sourceBranch`, `targetBranch`, `title` |
| `repositories_update_pull_request`      | Met à jour une pull request           | `project`, `repository`, `pullRequestId`, `status`               |
| `repositories_get_pr_threads`           | Récupère les threads de discussion    | `project`, `repository`, `pullRequestId`                         |
| `repositories_get_pr_thread_comments`   | Récupère les commentaires d'un thread | `project`, `repository`, `pullRequestId`, `threadId`             |
| `repositories_create_pr_thread`         | Crée un thread de discussion          | `project`, `repository`, `pullRequestId`, `comments`             |
| `repositories_update_pr_thread`         | Met à jour un thread                  | `project`, `repository`, `pullRequestId`, `threadId`, `status`   |
| `repositories_create_pr_thread_comment` | Ajoute un commentaire                 | `project`, `repository`, `pullRequestId`, `threadId`, `content`  |
| `repositories_add_pr_reviewers`         | Ajoute des reviewers                  | `project`, `repository`, `pullRequestId`, `reviewerIds`          |
| `repositories_get_commits`              | Liste les commits                     | `project`, `repository`, `branch`                                |
| `repositories_get_commit`               | Détails d'un commit                   | `project`, `repository`, `commitId`                              |
| `repositories_get_commit_changes`       | Changements d'un commit               | `project`, `repository`, `commitId`                              |
| `repositories_get_items`                | Récupère des fichiers/dossiers        | `project`, `repository`, `path`, `branch`                        |
| `repositories_get_item_content`         | Contenu d'un fichier                  | `project`, `repository`, `path`, `branch`                        |
| `repositories_create_push`              | Crée un push (commit)                 | `project`, `repository`, `branch`, `changes`                     |
| `repositories_get_pushes`               | Liste les pushes                      | `project`, `repository`, `fromDate`, `toDate`                    |

**Exemple d'utilisation:**

```json
{
  "name": "repositories_get_pull_requests",
  "arguments": {
    "project": "MyProject",
    "repository": "MyRepo",
    "status": "active",
    "top": 20
  }
}
```

---

### 4. WORK_ITEMS (Gestion des Tâches)

| Tool Name                          | Description                     | Paramètres Principaux                         |
| ---------------------------------- | ------------------------------- | --------------------------------------------- |
| `workitems_get_work_item`          | Récupère un work item par ID    | `project`, `id`                               |
| `workitems_create_work_item`       | Crée un work item               | `project`, `type`, `title`, `description`     |
| `workitems_update_work_item`       | Met à jour un work item         | `project`, `id`, `fields`                     |
| `workitems_add_work_item_comment`  | Ajoute un commentaire           | `project`, `id`, `text`                       |
| `workitems_get_work_item_comments` | Liste les commentaires          | `project`, `id`                               |
| `workitems_link_work_items`        | Lie deux work items             | `project`, `sourceId`, `targetId`, `linkType` |
| `workitems_add_artifact_link`      | Ajoute un lien vers un artefact | `project`, `id`, `artifactUri`                |
| `workitems_query_work_items`       | Exécute une requête WIQL        | `project`, `wiql`                             |
| `workitems_get_query_results`      | Exécute une query sauvegardée   | `project`, `queryId`                          |
| `workitems_get_work_items_batch`   | Récupère plusieurs work items   | `ids`, `fields`                               |

**Exemple d'utilisation:**

```json
{
  "name": "workitems_create_work_item",
  "arguments": {
    "project": "MyProject",
    "type": "Bug",
    "title": "Login page not responsive",
    "description": "The login page doesn't adapt to mobile screens"
  }
}
```

---

### 5. WORK (Itérations et Sprints)

| Tool Name                       | Description                        | Paramètres Principaux                        |
| ------------------------------- | ---------------------------------- | -------------------------------------------- |
| `work_create_iteration`         | Crée une nouvelle itération        | `project`, `name`, `startDate`, `finishDate` |
| `work_assign_iteration_to_team` | Assigne une itération à une équipe | `project`, `team`, `iterationId`             |
| `work_get_team_iterations`      | Liste les itérations d'une équipe  | `project`, `team`                            |
| `work_get_backlog_items`        | Récupère les items du backlog      | `project`, `team`, `backlogId`               |

---

### 6. WIKI (Documentation)

| Tool Name                    | Description                    | Paramètres Principaux                |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| `wiki_list_wikis`            | Liste les wikis d'un projet    | `project`                            |
| `wiki_get_page`              | Récupère le contenu d'une page | `project`, `wiki`, `path`            |
| `wiki_list_pages`            | Liste les pages d'un wiki      | `project`, `wiki`                    |
| `wiki_create_or_update_page` | Crée ou met à jour une page    | `project`, `wiki`, `path`, `content` |

---

### 7. TEST_PLANS (Plans de Test)

| Tool Name                          | Description                    | Paramètres Principaux                        |
| ---------------------------------- | ------------------------------ | -------------------------------------------- |
| `testplans_list_test_plans`        | Liste les plans de test        | `project`                                    |
| `testplans_create_test_plan`       | Crée un plan de test           | `project`, `name`, `areaPath`                |
| `testplans_list_test_cases`        | Liste les cas de test          | `project`, `planId`, `suiteId`               |
| `testplans_create_test_case`       | Crée un cas de test            | `project`, `title`, `steps`                  |
| `testplans_add_test_case_to_suite` | Ajoute un cas à une suite      | `project`, `planId`, `suiteId`, `testCaseId` |
| `testplans_get_test_results`       | Récupère les résultats de test | `project`, `buildId`                         |

---

### 8. SEARCH (Recherche)

| Tool Name           | Description                   | Paramètres Principaux                 |
| ------------------- | ----------------------------- | ------------------------------------- |
| `search_code`       | Recherche dans le code        | `searchText`, `project`, `repository` |
| `search_wiki`       | Recherche dans les wikis      | `searchText`, `project`               |
| `search_work_items` | Recherche dans les work items | `searchText`, `project`               |

**Exemple d'utilisation:**

```json
{
  "name": "search_code",
  "arguments": {
    "searchText": "async function login",
    "project": "MyProject",
    "repository": "frontend"
  }
}
```

---

### 9. ADVANCED_SECURITY (Sécurité)

| Tool Name                  | Description                     | Paramètres Principaux                          |
| -------------------------- | ------------------------------- | ---------------------------------------------- |
| `advsec_get_alerts`        | Liste les alertes de sécurité   | `project`, `repository`, `alertType`, `states` |
| `advsec_get_alert_details` | Détails d'une alerte spécifique | `project`, `repository`, `alertId`             |

---

## 📝 Prompts Disponibles

### 1. Projects

**Description:** Liste tous les projets de l'organisation  
**Paramètres:** Aucun  
**Sortie:** Tableau avec nom et ID des projets

### 2. Teams

**Description:** Liste toutes les équipes d'un projet  
**Paramètres:**

- `project` (string): Nom du projet

**Sortie:** Tableau avec nom et ID des équipes

### 3. getWorkItem

**Description:** Récupère les détails d'un work item  
**Paramètres:**

- `id` (string): ID du work item
- `project` (string): Nom du projet

**Sortie:** Détails formatés du work item (ID, titre, état, assigné à, type, description, date de création)

---

## 🔐 Authentification Actuelle

### Modes Supportés

1. **Interactive** (Recommandé)
   - OAuth 2.0 avec MSAL
   - Ouvre un navigateur pour l'authentification
   - Gestion automatique des refresh tokens
   - Meilleure expérience utilisateur

2. **Azure CLI** (`azcli`)
   - Utilise les credentials Azure CLI existants
   - Idéal pour Codespaces et environnements de développement
   - Nécessite `az login` préalable

3. **Environment** (`env`)
   - Utilise DefaultAzureCredential
   - Variables d'environnement ou Managed Identity
   - Idéal pour automation/CI/CD

### Scopes OAuth

```
499b84ac-1321-427f-aa17-267ca6975798/.default
```

_Ce scope correspond à l'accès complet à Azure DevOps avec les permissions de l'utilisateur._

---

## 📊 Statistiques

- **Total de tools:** ~50+
- **Total de prompts:** 3
- **Domaines couverts:** 9
- **APIs Azure DevOps utilisées:**
  - Core API
  - Build API
  - Git API
  - Work Item Tracking API
  - Wiki API
  - Test Plan API
  - Search API
  - Advanced Security API

---

## ✅ Test de Validation

### Phase 0 Complétée ✅

1. ✅ **Dépendances installées** - npm install réussi (709 packages)
2. ✅ **Compilation réussie** - TypeScript compilé vers dist/
3. ✅ **Serveur démarrable** - Le serveur démarre sans erreur
4. ✅ **Documentation créée** - Capacités documentées pour référence

### Prérequis Validés

- ✅ Node.js 20+ installé
- ✅ npm fonctionne correctement
- ✅ TypeScript 5.9+ configuré
- ✅ Azure DevOps accessible (organisation: nexusinno)
- ✅ Authentification interactive disponible

---

## 🎯 Prochaines Étapes

Avec cette validation complète de la **Phase 0**, nous sommes prêts pour la **Phase 1** :

### Phase 1 : Transformation HTTP Transport

- Remplacer StdioServerTransport par HTTP
- Implémenter les endpoints REST pour MCP
- Ajouter la couche OAuth 2.0 pour Copilot Studio
- Tester localement avec HTTP

**Estimation:** 3-5 jours  
**Complexité:** ⭐⭐⭐ Moyenne

---

## 📚 Références

- **Repository:** https://github.com/microsoft/azure-devops-mcp
- **MCP Specification:** https://modelcontextprotocol.io/specification
- **Azure DevOps REST API:** https://learn.microsoft.com/en-us/rest/api/azure/devops/

---

**Validé le:** 2025-10-07  
**Par:** GitHub Copilot + Équipe DevOps
