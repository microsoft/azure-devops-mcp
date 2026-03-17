data "azurerm_container_registry" "acr" {
  name                = "${replace(local.application, "-", "")}registry"
  resource_group_name = "rg-${local.application}"
}

data "azurerm_container_app_environment" "containerApps" {
  name                = "${local.application}-env"
  resource_group_name = "rg-${local.application}"
}

data "azurerm_application_insights" "appi" {
  name                = "${local.application}-appi"
  resource_group_name = "rg-${local.application}"
}
