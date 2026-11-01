import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
// Web configuration identifies the project; authorization is enforced by Firestore rules.
export const app=initializeApp({apiKey:'AIzaSyBVLei7bl_BQGQYSfNvqkhHnTfgYcckLj4',authDomain:'clb-vovinam-antruong.firebaseapp.com',projectId:'clb-vovinam-antruong',appId:'1:333636723863:web:3b82f17394d0bec89475d2'});
export const auth=getAuth(app);
export const db=getFirestore(app);
export const clubId='antruong-v2';
