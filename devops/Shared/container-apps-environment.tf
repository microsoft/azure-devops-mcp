# Conditional creation of resource to avoid
# Error: Missing required argument - all of `infrastructure_subnet_id,zone_redundancy_enabled` must be specified
# https://github.com/hashicorp/terraform-provider-azurerm/issues/25303

# Default Container Apps Environment
resource "azurerm_container_app_environment" "containerApps" {
  name                       = "${local.resource_prefix}-env"
  resource_group_name        = azurerm_resource_group.stage.name
  location                   = azurerm_resource_group.stage.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.stage.id
  tags                       = local.default_tags
}
