## 1. Mise à jour de la configuration et des arguments CLI

- [x] 1.1 Ajouter les options `--url` et `--api-version` dans `src/index.ts` via yargs.
- [x] 1.2 Ajouter l'alias `pat` pour l'option d'authentification `envvar` dans `src/index.ts`.
- [x] 1.3 Mettre à jour l'exportation de `orgUrl` pour qu'elle utilise l'URL fournie via `--url` si elle est présente.

## 2. Centralisation et injection de la version d'API

- [x] 2.1 Modifier `src/utils.ts` pour transformer les constantes d'API en variables exportées modifiables ou via un singleton de configuration.
- [x] 2.2 Initialiser la version d'API dans `src/index.ts` à partir de l'argument `--api-version`.
- [x] 2.3 Mettre à jour `src/shared/domains.ts` si nécessaire pour supporter la version dynamique.

## 3. Adaptation des outils (src/tools/\*.ts)

- [x] 3.1 Mettre à jour `src/tools/pipelines.ts` pour utiliser l'URL de base et la version d'API dynamiques.
- [x] 3.2 Mettre à jour `src/tools/work-items.ts` pour utiliser l'URL de base et la version d'API dynamiques.
- [x] 3.3 Mettre à jour `src/tools/repositories.ts` pour utiliser l'URL de base et la version d'API dynamiques.
- [x] 3.4 Mettre à jour les autres fichiers d'outils (`wiki.ts`, `search.ts`, `core.ts`, etc.) de manière similaire.

## 4. Tests et Validation

- [x] 4.1 Ajouter des tests unitaires pour valider la construction des URLs avec une instance Server.
- [x] 4.2 Vérifier que l'authentification PAT fonctionne correctement avec une URL personnalisée.
- [x] 4.3 S'assurer que le comportement par défaut (Cloud) reste inchangé.
