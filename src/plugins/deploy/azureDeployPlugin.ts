import Serverless from "serverless";
import { ResourceService } from "../../services/resourceService";
import { FunctionAppService } from "../../services/functionAppService";

export class AzureDeployPlugin {
  public hooks: { [eventName: string]: Promise<any> };
  public commands: any;

  public constructor(private serverless: Serverless, private options: Serverless.Options) {
    this.hooks = {
      "deploy:deploy": this.deploy.bind(this)
    };

    this.serverless.cli.log(this.serverless.pluginManager.plugins.length.toString());
    // TODO: Find the core deploy plugin and set resourceGroup option
    const coreDeployPlugin = this.serverless.pluginManager.plugins
      .find((plugin) => plugin["commands"]["deploy"]);

    if (coreDeployPlugin) {
      coreDeployPlugin["options"]["resourceGroup"] = {
        usage: "Resource group for deployment",
        shortcut: "rg",
      }
    }
  }

  private async deploy() {
    const resourceService = new ResourceService(this.serverless, this.options);
    await resourceService.deployResourceGroup();

    const functionAppService = new FunctionAppService(this.serverless, this.options);

    const functionApp = await functionAppService.deploy();
    await functionAppService.uploadFunctions(functionApp);
  }
}
