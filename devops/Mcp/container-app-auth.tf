resource "azapi_resource" "mcp_auth" {
  type      = "Microsoft.App/containerApps/authConfigs@2024-03-01"
  name      = "current"
  parent_id = azurerm_container_app.mcp.id

  body = {
    properties = {
      platform = {
        enabled = true
      }
      globalValidation = {
        unauthenticatedClientAction = "Return401"
      }
      httpSettings = {
        requireHttps = true
      }
      identityProviders = {
        azureActiveDirectory = {
          enabled = true
          registration = {
            clientId     = var.microsoft_auth_client_id
            openIdIssuer = "https://login.microsoftonline.com/${var.microsoft_auth_tenant_id}/v2.0"
          }
          validation = {
            allowedAudiences = [
              "api://${var.microsoft_auth_client_id}"
            ]
          }
        }
      }
      login = {
        preserveUrlFragmentsForLogins = false
      }
    }
  }

  depends_on = [
    azurerm_container_app.mcp
  ]
}
