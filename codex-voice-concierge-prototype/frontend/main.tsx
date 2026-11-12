import React from 'react';
import {createRoot} from 'react-dom/client';
import './chat-picker';
import './voice-controller';
import {DesktopPrototype} from './desktop-prototype';
const prototypeRoot=document.createElement('div');
document.body.append(prototypeRoot);
createRoot(prototypeRoot).render(<DesktopPrototype/>);

void import('./transcript').then(({Transcript})=>{
  createRoot(document.getElementById('log')!).render(<Transcript/>);
});
