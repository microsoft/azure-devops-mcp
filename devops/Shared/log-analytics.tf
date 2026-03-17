resource "azurerm_log_analytics_workspace" "stage" {
  name                = "${local.resource_prefix}-log"
  resource_group_name = azurerm_resource_group.stage.name
  location            = azurerm_resource_group.stage.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.default_tags
}

resource "azurerm_application_insights" "ai" {
  name                = "${local.resource_prefix}-appi"
  resource_group_name = azurerm_resource_group.stage.name
  location            = azurerm_resource_group.stage.location
  workspace_id        = azurerm_log_analytics_workspace.stage.id
  application_type    = "web"
  sampling_percentage = 0 # By default it is 100%, but it was 0% in Azure. Needs investigation
  tags                = local.default_tags
}
