import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firestore } from 'firebase-admin';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { catchError, defer, from, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

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
export class SpaceService {

  // TODO: Replace with Memcache
  private readonly tokens = new Map<string, string>();

  constructor(private readonly http: HttpService) {}

  storeClient({ clientId, clientSecret, serverUrl }: SpaceClient): Observable<void> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    return defer(() => from(collection.doc(clientId).set({ clientSecret, serverUrl })))
      .pipe(map(() => undefined));
  }

  queryClient(clientId: string): Observable<SpaceClient | undefined> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    return defer(() => from(collection.doc(clientId).get())).pipe(
      map(snapshot => snapshot.exists ? { ...snapshot.data(), clientId } as SpaceClient : undefined),
    );
  }

  authenticate(clientId: string): Observable<SpaceSession>;

  authenticate(client: SpaceClient): Observable<SpaceSession>;

  authenticate(param: string | SpaceClient): Observable<SpaceSession> {
    if (typeof param === 'string') {
      const clientId = param;
      return this.queryClient(clientId).pipe(
        switchMap(client => {
          if (!client) {
            throw new Error('Unregistered clientId!');
          }
          return this.authenticate(client);
        }),
      );
    }
    const client = param;
    return this.getSpaceToken(client).pipe(
      map(accessToken => ({ clientId: client.clientId, serverUrl: client.serverUrl, accessToken })),
    );
  }

  sendMessageToChannel(session: SpaceSession, channelId: string, message: string): Observable<void> {
    return this.post(session, '/chats/messages/send-message', {
      channel: { className: 'ChannelIdentifier.Id', id: channelId },
      content: { className: 'ChatMessage.Text', text: message }
    });
  }

  sendMessageToUser(session: SpaceSession, userId: string, message: string): Observable<void> {
    return this.post(session, '/chats/messages/send-message', {
      recipient: { className: 'MessageRecipient.Member', member: { className: 'ProfileIdentifier.Id', id: userId } },
      content: { className: 'ChatMessage.Text', text: message }
    });
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

  private post(session: SpaceSession, uri: string, data: any): Observable<void> {
    return this.request(session, 'POST', uri, data).pipe(map(() => undefined));
  }

  private request({ serverUrl, accessToken }: SpaceSession, method: string, uri: string, data?: any): Observable<any> {
    return this.http.request({
      method,
      url: `${serverUrl}/api/http${uri}`,
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      data,
    }).pipe(
      map(response => response.data),
      catchError(error => {
        console.error(error);
        return throwError(() => error);
      }),
    );
  }
}
