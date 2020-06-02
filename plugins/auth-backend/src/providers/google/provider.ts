/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import express from 'express';
import jwtDecoder from 'jwt-decode';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {
  executeFrameHandlerStrategy,
  executeRedirectStrategy,
  executeRefreshTokenStrategy,
} from '../PassportStrategyHelper';
import {
  OAuthProviderHandlers,
  AuthInfoBase,
  AuthInfoPrivate,
  RedirectInfo,
  AuthProviderConfig,
  AuthInfoWithProfile,
} from '../types';
import { OAuthProvider } from '../OAuthProvider';

export class GoogleAuthProvider implements OAuthProviderHandlers {
  private readonly providerConfig: AuthProviderConfig;
  private readonly _strategy: GoogleStrategy;

  constructor(providerConfig: AuthProviderConfig) {
    this.providerConfig = providerConfig;
    // TODO: throw error if env variables not set?
    this._strategy = new GoogleStrategy(
      { ...this.providerConfig.options },
      (
        accessToken: any,
        refreshToken: any,
        params: any,
        profile: any,
        done: any,
      ) => {
        done(
          undefined,
          {
            profile,
            idToken: params.id_token,
            accessToken,
            scope: params.scope,
            expiresInSeconds: params.expires_in,
          },
          {
            refreshToken,
          },
        );
      },
    );
  }

  async start(req: express.Request, options: any): Promise<RedirectInfo> {
    return await executeRedirectStrategy(req, this._strategy, options);
  }

  async handler(
    req: express.Request,
  ): Promise<{ user: AuthInfoBase; info: AuthInfoPrivate }> {
    return await executeFrameHandlerStrategy(req, this._strategy);
  }

  async refresh(
    provider: string,
    refreshToken: string,
    scope: string,
  ): Promise<AuthInfoWithProfile> {
    const { accessToken, params } = await executeRefreshTokenStrategy(
      this._strategy,
      refreshToken,
      scope,
    );

    // TODO(soapraj): check what happens when you return undefined
    let profile;
    try {
      const { email, name, picture } = jwtDecoder(params.id_token);
      profile = {
        provider,
        email,
        name,
        picture,
      };
    } catch (e) {
      console.error('Failed to parse id token and get profile info');
    }

    return {
      accessToken,
      idToken: params.id_token,
      expiresInSeconds: params.expires_in,
      scope: params.scope,
      profile,
    };
  }
}

export function createGoogleProvider(config: AuthProviderConfig) {
  const provider = new GoogleAuthProvider(config);
  const oauthProvider = new OAuthProvider(provider, config.provider);
  return oauthProvider;
}
