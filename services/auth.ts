import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

export function useGoogleDriveAuth(clientId: string) {
  const redirectUri = AuthSession.makeRedirectUri();
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    },
    DISCOVERY
  );

  const accessToken =
    response?.type === "success" ? response.authentication?.accessToken : null;

  return { request, accessToken, promptAsync };
}
