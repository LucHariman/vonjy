import { Injectable } from '@nestjs/common';

import { firestore } from 'firebase-admin';

export interface ClientDetails {
  clientSecret: string;
  serverUrl: string;
}

const SPACE_APP_INSTANCES_COLLECTION = 'spaceAppInstances';

@Injectable()
export class AppService {

  async storeClientDetails(clientId: string, details: ClientDetails): Promise<void> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    await collection.doc(clientId).set(details);
  }

  async queryClientDetails(clientId: string): Promise<ClientDetails | undefined> {
    const collection = firestore().collection(SPACE_APP_INSTANCES_COLLECTION);
    const snapshot = await collection.doc(clientId).get();
    return snapshot.exists ? snapshot.data() as ClientDetails : undefined;
  }
}
