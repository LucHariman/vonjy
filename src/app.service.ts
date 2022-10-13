import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firestore } from 'firebase-admin';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { defer, from, map, Observable, of, switchMap, tap } from 'rxjs';

export interface SpaceClient {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
}

export interface SpaceSession {
  clientId: string;
  serverUrl: string;
  accessToken: string;
}

const SPACE_APP_INSTANCES_COLLECTION = 'spaceAppInstances';

function hasTokenExpired(token: string): boolean {
  const expirationDate = getTokenExpirationDate(token);
  return expirationDate.getTime() < Date.now();
}

function getTokenExpirationDate(token: string): Date {
  const payload = jwtDecode<JwtPayload>(token);
  if (!payload.exp) {
    throw new Error('Token has no expiration time!');
  }
  return new Date(payload.exp * 1e3);
}

@Injectable()
export class AppService {

  // TODO: Replace with Memcache
  private readonly tokens = new Map<string, string>();

  constructor(private readonly http: HttpService) {}

  storeSpaceClient({ clientId, clientSecret, serverUrl }: SpaceClient): Observable<void> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    return defer(() => from(collection.doc(clientId).set({ clientSecret, serverUrl })))
      .pipe(map(() => undefined));
  }

  querySpaceClient(clientId: string): Observable<SpaceClient | undefined> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    return defer(() => from(collection.doc(clientId).get())).pipe(
      map(snapshot => snapshot.exists ? { ...snapshot.data(), clientId } as SpaceClient : undefined),
    );
  }

  authenticateToSpace(clientId: string): Observable<SpaceSession> {
    // cache token in memory and renew them when expired
    return this.querySpaceClient(clientId).pipe(
      switchMap(spaceClient => {
        if (!spaceClient) {
          throw new Error('Unregistered clientId!');
        }
        return this.getSpaceToken(spaceClient).pipe(
          map(accessToken => ({ clientId, serverUrl: spaceClient.serverUrl, accessToken })),
        );
      }),
    );
  }

  sendMessageToSpaceChannel({ serverUrl, accessToken }: SpaceSession, channelId: string, message: string): Observable<void> {
    return this.http.post(
      `${serverUrl}/api/http/chats/messages/send-message`,
      {
        channel: { className: 'ChannelIdentifier.Id', id: channelId },
        content: { className: 'ChatMessage.Text', text: message }
      },
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    ).pipe(map(() => undefined));
  }

  private getSpaceToken({ clientId, clientSecret, serverUrl }: SpaceClient): Observable<string> {
    const cachedToken = this.tokens.get(clientId);
    if (cachedToken && !hasTokenExpired(cachedToken)) {
      return of(cachedToken);
    }
    return this.http.post(
      `${serverUrl}/oauth/token`,
      new URLSearchParams({ 'grant_type': 'client_credentials', 'scope': '**' }),
      { auth: { username: clientId, password: clientSecret } }
    ).pipe(
      map(response => response.data['access_token']),
      tap(token => this.tokens.set(clientId, token)),
    );
  }
}
