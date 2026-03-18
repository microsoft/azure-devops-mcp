resource "azurerm_container_app" "mcp" {
  name                         = "${local.resource_prefix}-app"
  resource_group_name          = azurerm_resource_group.stage.name
  container_app_environment_id = data.azurerm_container_app_environment.containerApps.id
  revision_mode                = "Single"

  secret {
    name  = "registry-password"
    value = data.azurerm_container_registry.acr.admin_password
  }

  secret {
    name  = "devops-pat-token"
    value = var.ado_mcp_auth_token
  }

  secret {
    name  = "microsoft-auth-client-secret"
    value = var.microsoft_auth_client_secret
  }

  registry {
    server               = data.azurerm_container_registry.acr.login_server
    username             = data.azurerm_container_registry.acr.admin_username
    password_secret_name = "registry-password"
  }

  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    container {
      name   = "azure-devops-mcp"
      image  = "${data.azurerm_container_registry.acr.login_server}/azure-devops-mcp:${var.build_number}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name        = "ADO_MCP_AUTH_TOKEN"
        secret_name = "devops-pat-token"
      }

      env {
        name  = "MCP_HTTP_SKIP_EASY_AUTH"
        value = "0"
      }
    }
  }

  tags = local.default_tags
}
