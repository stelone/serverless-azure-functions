import open from "open";
import {
  interactiveLoginWithAuthResponse,
  loginWithServicePrincipalSecretWithAuthResponse,
  AuthResponse,
  InteractiveLoginOptions,
  interactiveLogin,
  DeviceTokenCredentials,
  LinkedSubscription,
  UserTokenCredentials,

} from "@azure/ms-rest-nodeauth";
import { SimpleFileTokenCache } from "../plugins/login/utils/simpleFileTokenCache";

export interface AzureLoginOptions {
  subscriptionId?: string;
  clientId?: string;
  tenantId?: string;
  password?: string;
  interactive?: boolean;
}

export class AzureLoginService {
  public static async login(options: AzureLoginOptions = {}, iOptions?: InteractiveLoginOptions): Promise<AuthResponse> {
    console.log("Asure service options: ")
    console.log(options);
    console.log(iOptions)
    if (!iOptions){
      if (options.clientId && options.password && options.tenantId) {
        console.log("wrong");
        console.log(options);
        return await AzureLoginService.servicePrincipalLogin(options);
      }
    } else {
      console.log("correct, here's the options we'll use to log in");
      console.log(iOptions);
      return await AzureLoginService.interactiveLogin(options, iOptions);
    }
  }

  public static async interactiveLogin(options?: AzureLoginOptions, iOptions?: any): Promise<AuthResponse> {
    console.log("login service options: ");
    console.log(iOptions);
    var authResp: AuthResponse = {credentials: undefined, subscriptions: [iOptions.subscription]};
    var tokenCache = iOptions.tokenCache as SimpleFileTokenCache;
    if(!tokenCache.empty()){
      // better way of retrieving this?
      let token = tokenCache.first();
      console.log("existing token");
      authResp.credentials = new DeviceTokenCredentials(undefined, undefined, token["userId"], undefined, undefined, tokenCache);
      console.log("authResp", await authResp.credentials.getToken());
    } else {
      console.log("need to do interactive login now")
      await open("https://microsoft.com/devicelogin")
      authResp = await interactiveLoginWithAuthResponse(iOptions);
    }
    return authResp;
  }

  public static async servicePrincipalLogin(options: AzureLoginOptions): Promise<AuthResponse> {
    return loginWithServicePrincipalSecretWithAuthResponse(options.clientId, options.password, options.tenantId);
  }
}
