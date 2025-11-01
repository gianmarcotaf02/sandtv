import { useState, useEffect } from 'react';
import { getAuth, getDb } from '../lib/firebase';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((firebaseUser: any) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    const auth = getAuth();
    
    // Imposta la persistenza basata sul checkbox "Mantieni connesso"
    if (rememberMe) {
      // @ts-ignore
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); // Mantieni login anche dopo chiusura browser
    } else {
      // @ts-ignore
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); // Login valido solo per la sessione corrente
    }
    
    await auth.signInWithEmailAndPassword(email, password);
  };

  const register = async (email: string, password: string) => {
    const auth = getAuth();
    await auth.createUserWithEmailAndPassword(email, password);
  };

  const loginWithGoogle = async () => {
    const auth = getAuth();
    // @ts-ignore
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  };

  const logout = async () => {
    const auth = getAuth();
    await auth.signOut();
  };

  const savePlaylist = async (m3uUrl: string, epgUrl: string | null) => {
    if (!user) {
      console.error('Cannot save playlist: User not logged in');
      throw new Error('User not logged in');
    }
    
    console.log('Saving playlist for user:', user.uid);
    console.log('M3U URL:', m3uUrl);
    console.log('EPG URL:', epgUrl);
    
    const db = getDb();
    if (!db) {
      console.error('Firestore not initialized');
      throw new Error('Firestore not initialized');
    }
    
    try {
      await db.collection('playlists').doc(user.uid).set({
        m3uUrl,
        epgUrl,
        updatedAt: new Date().toISOString(),
      });
      console.log('Playlist saved successfully!');
    } catch (error) {
      console.error('Error saving playlist:', error);
      throw error;
    }
  };

  const loadPlaylist = async (): Promise<{ m3uUrl: string; epgUrl: string | null } | null> => {
    if (!user) {
      console.log('Cannot load playlist: User not logged in');
      return null;
    }
    
    console.log('Loading playlist for user:', user.uid);
    
    const db = getDb();
    if (!db) {
      console.error('Firestore not initialized');
      return null;
    }
    
    try {
      const doc = await db.collection('playlists').doc(user.uid).get();
      
      if (doc.exists) {
        const data = doc.data();
        console.log('Playlist loaded:', data);
        return data as { m3uUrl: string; epgUrl: string | null };
      } else {
        console.log('No saved playlist found for user');
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
    
    return null;
  };

  const saveCustomGroups = async (groups: any[]) => {
    if (!user) {
      console.error('Cannot save groups: User not logged in');
      throw new Error('User not logged in');
    }
    // Ensure Firestore is initialized (retry a few times if the CDN script hasn't executed yet)
    let dbInstance: any = getDb();
    const start = Date.now();
    while (!dbInstance && Date.now() - start < 2000) {
      // wait a bit for the firebase global to be ready
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 200));
      dbInstance = getDb();
    }

    if (!dbInstance) {
      console.error('Firestore not initialized after retries');
      throw new Error('Firestore not initialized');
    }

    try {
      await dbInstance.collection('users').doc(user.uid).set({
        customGroups: groups,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('Groups saved successfully!');
      return true;
    } catch (error) {
      console.error('Error saving groups:', error);
      throw error;
    }
  };

  const loadCustomGroups = async (): Promise<any[] | null> => {
    if (!user) {
      console.log('Cannot load groups: User not logged in');
      return null;
    }
    // Ensure Firestore initialized (retry briefly)
    let dbInstance: any = getDb();
    const start = Date.now();
    while (!dbInstance && Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 200));
      dbInstance = getDb();
    }

    if (!dbInstance) {
      console.error('Firestore not initialized');
      return null;
    }

    try {
      const doc = await dbInstance.collection('users').doc(user.uid).get();

      if (doc.exists) {
        const data = doc.data();
        console.log('Groups loaded:', data?.customGroups);
        return data?.customGroups || null;
      } else {
        console.log('No saved groups found for user');
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }

    return null;
  };

  // Save generic user data (favorites, settings, customGroups, watchHistory)
  const saveUserData = async (data: any) => {
    if (!user) {
      console.error('Cannot save user data: User not logged in');
      throw new Error('User not logged in');
    }
    // Ensure Firestore initialized (retry briefly)
    let dbInstance: any = getDb();
    const start = Date.now();
    while (!dbInstance && Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 200));
      dbInstance = getDb();
    }

    if (!dbInstance) {
      console.error('Firestore not initialized');
      throw new Error('Firestore not initialized');
    }
    try {
      await dbInstance.collection('users').doc(user.uid).set({
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('User data saved successfully!');
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  };

  const loadUserData = async (): Promise<any | null> => {
    if (!user) {
      console.log('Cannot load user data: User not logged in');
      return null;
    }
    // Ensure Firestore initialized (retry briefly)
    let dbInstance: any = getDb();
    const start = Date.now();
    while (!dbInstance && Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 200));
      dbInstance = getDb();
    }

    if (!dbInstance) {
      console.error('Firestore not initialized');
      return null;
    }
    try {
      const doc = await dbInstance.collection('users').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        console.log('User data loaded:', data);
        return data || null;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    return null;
  };

  return {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    savePlaylist,
    loadPlaylist,
    saveCustomGroups,
    loadCustomGroups,
    saveUserData,
    loadUserData,
  };
};
