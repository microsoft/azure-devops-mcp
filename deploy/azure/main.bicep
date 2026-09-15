// Azure Container Apps deployment for the Azure DevOps MCP server (HTTP transport).
//
// The platform ingress terminates TLS and provides the public FQDN; the
// container listens on 0.0.0.0:targetPort over plain HTTP inside the
// environment. DNS rebinding protection is pinned to the app's own FQDN, which
// is derived from the managed environment's default domain. No Azure DevOps
// credentials are stored here: the server uses token pass-through, so each
// request must carry the caller's bearer token.
//
// The image is pulled from Azure Container Registry using a user-assigned
// managed identity granted the AcrPull role — no registry username/password is
// stored anywhere.

@description('Base name for the Container App and supporting resources.')
param appName string = 'ado-mcp'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Fully qualified container image reference, e.g. myregistry.azurecr.io/ado-mcp:1.0.0')
param containerImage string

@description('Azure DevOps organization name the server is scoped to.')
param adoOrg string

@description('Name of the existing Azure Container Registry to pull the image from.')
param acrName string

@description('Resource group of the ACR. Defaults to this deployment\'s resource group; set it when reusing a registry that lives in another resource group.')
param acrResourceGroup string = resourceGroup().name

@description('Whether to create the AcrPull role assignment for the app identity. Requires the deployer to have permission to manage role assignments (e.g. Owner or User Access Administrator) on the registry. Set to false to assign the role out-of-band (e.g. when the ACR is in another resource group you do not control).')
param assignAcrPullRole bool = true

@description('HTTP auth mode: "passthrough" (clients send their own Azure DevOps bearer token) or "oauth" (server runs an OAuth authorization server bridging sign-in to Entra ID).')
@allowed([
  'passthrough'
  'oauth'
])
param authMode string = 'passthrough'

@description('Entra tenant ID (required when authMode is "oauth").')
param entraTenantId string = ''

@description('Entra confidential app (client) ID (required when authMode is "oauth").')
param entraClientId string = ''

@description('Entra confidential app client secret (required when authMode is "oauth").')
@secure()
param entraClientSecret string = ''

@description('Name of the storage account holding the OAuth server state (client registrations, pending authorizations, issued codes). Leave empty to keep that state in memory, which means every restart invalidates it and the app is pinned to a single replica.')
param oauthStateStorageAccountName string = ''

@description('Table that holds the OAuth server state.')
param oauthStateTableName string = 'oauthstate'

@description('Whether to create the "Storage Table Data Contributor" assignment for the app identity on the state storage account. Requires the deployer to be able to manage role assignments; set to false when it is granted out-of-band.')
param assignTableRole bool = true

@description('Tool domains to enable (space-separated), or "all".')
param enabledDomains string = 'all'

@description('Optional space-separated browser Origin allow-list. Leave empty for non-browser clients only.')
param allowedOrigins string = ''

@description('Optional email address to receive health/security alerts (e.g. a spike in 401/403 responses). Leave empty to skip the alert resources entirely.')
param alertEmail string = ''

@description('Number of 401/403 ingress responses within a 5-minute window that triggers the auth-failure alert. Tune to your normal traffic to avoid noise.')
param authFailureAlertThreshold int = 25

@description('Container port the server listens on.')
param targetPort int = 3000

@description('Minimum number of replicas. 0 enables scale-to-zero (lowest cost; adds cold-start latency to the first request after idle).')
param minReplicas int = 0

@description('Maximum number of replicas.')
param maxReplicas int = 3

@description('CPU cores per replica.')
param cpu string = '0.5'

@description('Memory per replica.')
param memory string = '1Gi'

// Built-in AcrPull role definition ID.
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// Registry login server. Derived from the name (public cloud convention
// "<name>.azurecr.io") rather than read from the registry resource, so the
// deploying identity needs no control-plane read on the registry — which may
// live in another resource group it cannot read.
var acrLoginServer = '${acrName}.azurecr.io'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// User-assigned identity the Container App uses to pull from ACR. Created (and
// granted AcrPull) before the app so the first revision can pull successfully.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-id'
  location: location
}

// Grant the app identity AcrPull on the registry. Done via a module so it works
// even when the ACR lives in another resource group. Skipped when
// assignAcrPullRole is false (e.g. the grant is made out-of-band by a registry
// admin you do not have rights over).
module acrPullAssignment 'acr-pull-role.bicep' = if (assignAcrPullRole) {
  name: 'acrPullAssignment'
  scope: resourceGroup(acrResourceGroup)
  params: {
    acrName: acrName
    principalId: identity.properties.principalId
    roleId: acrPullRoleId
  }
}

// Storage for the OAuth authorization server's own state. Shared-key access is
// disabled: the app reads and writes with its managed identity, so no account
// key exists to leak or rotate.
resource stateStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = if (persistOAuthState) {
  name: oauthStateStorageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}

resource stateTableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = if (persistOAuthState) {
  parent: stateStorage
  name: 'default'
}

resource stateTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = if (persistOAuthState) {
  parent: stateTableService
  name: oauthStateTableName
}

resource stateTableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (persistOAuthState && assignTableRole) {
  name: guid(stateStorage.id, identity.id, tableDataContributorRoleId)
  scope: stateStorage
  properties: {
    principalId: identity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', tableDataContributorRoleId)
    principalType: 'ServicePrincipal'
  }
}

// Public FQDN of the app: "<appName>.<environment default domain>". This is the
// Host header callers send, so it is exactly what DNS rebinding protection must
// allow.
var appFqdn = '${appName}.${environment.properties.defaultDomain}'

var isOAuth = authMode == 'oauth'

// OAuth state is persisted only when a storage account is named. Without it the
// state lives in process memory, which forces a single replica and loses every
// client registration on restart.
var persistOAuthState = isOAuth && !empty(oauthStateStorageAccountName)

// Built-in Storage Table Data Contributor role.
var tableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

var baseEnv = [
  { name: 'AZURE_DEVOPS_ORG', value: adoOrg }
  { name: 'MCP_TRANSPORT', value: 'http' }
  { name: 'MCP_HOST', value: '0.0.0.0' }
  { name: 'MCP_PORT', value: string(targetPort) }
  { name: 'MCP_ALLOWED_HOSTS', value: appFqdn }
  { name: 'MCP_ALLOWED_ORIGINS', value: allowedOrigins }
  { name: 'MCP_DOMAINS', value: enabledDomains }
  { name: 'MCP_AUTH', value: authMode }
]

// OAuth mode keeps its authorization state (client registrations, codes) in
// memory, so it must run as a single, always-warm replica.
var oauthEnv = isOAuth
  ? [
      { name: 'ENTRA_TENANT_ID', value: entraTenantId }
      { name: 'ENTRA_CLIENT_ID', value: entraClientId }
      { name: 'ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
      { name: 'MCP_PUBLIC_URL', value: 'https://${appFqdn}/' }
    ]
  : []

// Pointing the app at the table switches it off in-memory OAuth state.
// AZURE_CLIENT_ID picks the user-assigned identity for the storage credential.
var oauthStateEnv = persistOAuthState
  ? [
      { name: 'OAUTH_STATE_TABLE_ENDPOINT', value: stateStorage!.properties.primaryEndpoints.table }
      { name: 'OAUTH_STATE_TABLE_NAME', value: oauthStateTableName }
      { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
    ]
  : []

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  // Ensure the AcrPull role exists before the app attempts its first image pull,
  // and that the state table is reachable before the first authorization.
  dependsOn: [
    acrPullAssignment
    stateTable
    stateTableRole
  ]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: identity.id
        }
      ]
      secrets: isOAuth
        ? [
            {
              name: 'entra-client-secret'
              value: entraClientSecret
            }
          ]
        : []
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat(baseEnv, oauthEnv, oauthStateEnv)
        }
      ]
      scale: {
        // OAuth mode stays warm so a sign-in in flight is never dropped.
        minReplicas: isOAuth ? 1 : minReplicas
        // Several replicas are only safe once the OAuth state is shared; with
        // in-memory state a second replica would not recognise the first one's
        // client registrations or codes.
        maxReplicas: isOAuth && !persistOAuthState ? 1 : maxReplicas
      }
    }
  }
}

// Optional alerting. Both resources are created only when alertEmail is set, so
// the default deployment adds no monitoring cost. The Requests metric exposes a
// statusCode dimension, so we can alert specifically on 401/403 spikes (failed
// auth / probing) rather than all 4xx. Console and system logs already flow to
// Log Analytics via the managed environment's appLogsConfiguration.
var alertsEnabled = !empty(alertEmail)

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (alertsEnabled) {
  name: '${appName}-alerts'
  location: 'global'
  properties: {
    groupShortName: take(appName, 12)
    enabled: true
    emailReceivers: [
      {
        name: 'primary'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource authFailureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (alertsEnabled) {
  name: '${appName}-auth-failures'
  location: 'global'
  properties: {
    description: 'Spike in 401/403 responses from the MCP ingress (possible credential brute force, probing, or a misconfigured client).'
    severity: 2
    enabled: true
    scopes: [
      containerApp.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    autoMitigate: true
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AuthFailures'
          metricNamespace: 'Microsoft.App/containerapps'
          metricName: 'Requests'
          operator: 'GreaterThan'
          threshold: authFailureAlertThreshold
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'statusCode'
              operator: 'Include'
              values: [
                '401'
                '403'
              ]
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

@description('Public FQDN of the deployed MCP server.')
output fqdn string = containerApp.properties.configuration.ingress.fqdn

@description('MCP endpoint URL to configure in clients.')
output mcpUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}/mcp'

@description('Table endpoint holding the OAuth server state, empty when that state is kept in memory.')
output oauthStateTableEndpoint string = persistOAuthState ? stateStorage!.properties.primaryEndpoints.table : ''
