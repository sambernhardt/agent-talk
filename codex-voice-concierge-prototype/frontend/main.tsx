import React from 'react';
import {createRoot} from 'react-dom/client';
import './chat-picker';
import './voice-controller';
void import('./transcript').then(({Transcript})=>{
  createRoot(document.getElementById('log')!).render(<Transcript/>);
});
