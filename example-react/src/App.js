import React, { useState, useEffect } from 'react';
import notifly from 'notifly-js-sdk-dev';
import logo from './logo.svg';
import './App.css';

function App() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      notifly.initialize(
        process.env.REACT_APP_NOTIFLY_PROJECT_ID,
        process.env.REACT_APP_NOTIFLY_USERNAME,
        process.env.REACT_APP_NOTIFLY_PASSWORD,
      );
    }
  }, []);  

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p className="App-link" rel="noopener noreferrer">
          Notifly js SDK example react app
        </p>
        <EventButton name="event_react_1" />
        <EventButton name="event_react_2" />
        <UserIdSetter />
      </header>
    </div>
  );
}

function EventButton({ name }) {
  const handleButtonClick = (buttonName) => {
    notifly.trackEvent(buttonName);
    console.log(`Button ${buttonName} clicked`);
  };
  return (
    <button
      style={{ margin: '10px' }}
      onClick={() => handleButtonClick(name)}
    >
      {name}
    </button>
  );
}

function UserIdSetter() {
  const [userIdInput, setUserIdInput] = useState("");

  const handleInputChange = (event) => {
    setUserIdInput(event.target.value);
  };

  const handleSetUserId = () => {
    notifly.setUserId(userIdInput);
    console.log(`Set user id to ${userIdInput}`)
  };

  return (
    <div style={{ margin: '10px' }}>
      <input
        type="text"
        name="setUserId"
        value={userIdInput}
        onChange={handleInputChange}
        placeholder="user id"
      />
      <button onClick={handleSetUserId}>Set User Id</button>
    </div>
  );
}

export default App;
