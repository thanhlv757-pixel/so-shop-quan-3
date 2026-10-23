import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from './page';
import './globals.css';
createRoot(document.getElementById('root')!).render(<><Home/><form method="post" action="/logout" style={{position:'fixed',bottom:8,left:12,zIndex:30}}><button style={{fontSize:11,padding:8,background:'#edf3e8',borderRadius:6}}>Đăng xuất</button></form></>);
