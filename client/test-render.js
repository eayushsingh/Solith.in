import { render } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './src/App.jsx';

try {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
} catch (e) {
  console.log("CRASH!");
  console.error(e);
}
