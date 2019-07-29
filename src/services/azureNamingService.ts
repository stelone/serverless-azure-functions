import md5 from "md5";
import Serverless from "serverless";
import configConstants from "../config";
import { ArmResourceType } from "../models/armTemplates";
import { DeploymentConfig, ServerlessAzureConfig, ServerlessAzureOptions } from "../models/serverless";
import { Utils } from "../shared/utils";

export class AzureNamingService {

  private config: ServerlessAzureConfig;

  public constructor(
    private serverless: Serverless,
    private options: ServerlessAzureOptions = { stage: null, region: null }
  ) {
    this.setDefaultValues();
    this.config = serverless.service as any;
  }

  /**
   * Name of Function App Service
   */
  public getServiceName(): string {
    return this.config.service;
  }

  /**
   * Name of Azure Region for deployment
   */
  public getRegion(): string {
    return this.options.region || this.config.provider.region;
  }

  /**
   * Name of current deployment stage
   */
  public getStage(): string {
    return this.options.stage || this.config.provider.stage;
  }

  /**
   * Name of prefix for service
   */
  public getPrefix(): string {
    return this.config.provider.prefix;
  }

  /**
   * Name of current resource group
   */
  public getResourceGroupName(): string {
    const regionName = Utils.createShortAzureRegionName(this.getRegion());
    const stageName = Utils.createShortStageName(this.getStage());

    return this.options.resourceGroup
      || this.config.provider.resourceGroup
      || `${this.getPrefix()}-${regionName}-${stageName}-${this.getServiceName()}-rg`;
  }

  /**
   * Name of current ARM deployment
   */
  public getDeploymentName(): string {
    const name = this.config.provider.deploymentName || `${this.getResourceGroupName()}-deployment`;
    return this.rollbackConfiguredName(name);
  }

  /**
   * Name of artifact uploaded to blob storage
   */
  public getArtifactName(deploymentName: string): string {
    return `${deploymentName
      .replace("rg-deployment", "artifact")
      .replace("deployment", "artifact")}.zip`;
  }

  /**
   * Get name of Azure resource
   * @param resource ARM Resource to name
   */
  public getResourceName(resource: ArmResourceType): string {
    switch (resource) {
      case ArmResourceType.Apim:
        return this.getApimName();
      case ArmResourceType.AppInsights:
        return this.getAppInsightsName();
      case ArmResourceType.AppServicePlan:
        return this.getAppServicePlanName();
      case ArmResourceType.FunctionApp:
        return this.getFunctionAppName();
      case ArmResourceType.HostingEnvironment:
        return this.getHostingEnvironmentName();
      case ArmResourceType.StorageAccount:
        return this.getStorageAccountName();
      case ArmResourceType.VirtualNetwork:
        return this.getVirtualNetworkName();
    }
  }

  private getConfiguredName(resource: { name?: string }, suffix: string) {
    return resource && resource.name
      ? resource.name
      : this.config.provider.prefix +
        "-" +
        Utils.createShortAzureRegionName(this.config.provider.region) +
        "-" +
        Utils.createShortStageName(this.config.provider.stage) +
        "-" +
        suffix;
  }

  private getApimName(): string {
    return this.getConfiguredName(this.config.provider.apim, "apim");
  }

  private getAppInsightsName(): string {
    return this.getConfiguredName(this.config.provider.appInsights, "appinsights");
  }

  private getAppServicePlanName(): string {
    return this.getConfiguredName(this.config.provider.appServicePlan, "asp");
  }

  private getFunctionAppName(): string {
    const safeServiceName = this.config.service.replace(/\s/g, "-");
    return this.getConfiguredName(this.config.provider.functionApp, safeServiceName);
  }

  private getHostingEnvironmentName(): string {
    return this.getConfiguredName(this.config.provider.hostingEnvironment, "ase");
  }

  private getStorageAccountName(): string {
    return this.config.provider.storageAccount && this.config.provider.storageAccount.name
      ? this.config.provider.storageAccount.name
      : this.getDefaultStorageAccountName()
  }

  private getVirtualNetworkName(): string {
    return this.getConfiguredName(this.config.provider.virtualNetwork, "vnet");
  }

  /**
   * Gets a default storage account name.
   * Storage account names can have at most 24 characters and can have only alpha-numerics
   * @param this.config Serverless Azure this.config
   */
  private getDefaultStorageAccountName(): string {
    const maxAccountNameLength = 24;
    const nameHash = md5(this.config.service);
    const replacer = /\W+/g;

    let safePrefix = this.config.provider.prefix.replace(replacer, "");
    const safeRegion = Utils.createShortAzureRegionName(this.config.provider.region);
    let safeStage = Utils.createShortStageName(this.config.provider.stage);
    let safeNameHash = nameHash.substr(0, 6);

    const remaining = maxAccountNameLength - (safePrefix.length + safeRegion.length + safeStage.length + safeNameHash.length);

    // Dynamically adjust the substring based on space needed
    if (remaining < 0) {
      const partLength = Math.floor(Math.abs(remaining) / 3);
      safePrefix = safePrefix.substr(0, partLength);
      safeStage = safeStage.substr(0, partLength);
      safeNameHash = safeNameHash.substr(0, partLength);
    }

    return [safePrefix, safeRegion, safeStage, safeNameHash]
      .join("")
      .toLocaleLowerCase();
  }

  /**
   * Add `-t{timestamp}` if rollback is enabled
   * @param name Original name
   */
  private rollbackConfiguredName(name: string) {
    return this.getDeploymentConfig().rollback
      ? `${name}-t${this.getTimestamp()}`
      : name;
  }

  /**
   * Get timestamp from `packageTimestamp` serverless variable
   * If not set, create timestamp, set variable and return timestamp
   */
  private getTimestamp(): number {
    let timestamp = +this.serverless.variables["packageTimestamp"];
    if (!timestamp) {
      timestamp = Date.now();
      this.serverless.variables["packageTimestamp"] = timestamp;
    }
    return timestamp;
  }

  /**
   * Deployment this.config from `serverless.yml` or default.
   * Defaults can be found in the `config.ts` file
   */
  private getDeploymentConfig(): DeploymentConfig {
    const providedConfig = this.serverless["deploy"] as DeploymentConfig;
    return {
      ...configConstants.deploymentConfig,
      ...providedConfig,
    }
  }


  private setDefaultValues(): void {
    // TODO: Right now the serverless core will always default to AWS default region if the
    // region has not been set in the serverless.yml or CLI options
    const awsDefault = "us-east-1";
    const providerRegion = this.serverless.service.provider.region;

    if (!providerRegion || providerRegion === awsDefault) {
      // no region specified in serverless.yml
      this.serverless.service.provider.region = "westus";
    }

    if (!this.serverless.service.provider.stage) {
      this.serverless.service.provider.stage = "dev";
    }

    if (!this.serverless.service.provider["prefix"]) {
      this.serverless.service.provider["prefix"] = "sls";
    }
  }
}