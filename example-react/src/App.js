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
  const [inputValues, setInputValues] = useState({
    input1: "",
    input2: "",
  });

  const handleButtonClick = (buttonName) => {
    console.log(`Button ${buttonName} clicked`);
  };

  const handleInputChange = (event) => {
    setInputValues({
      ...inputValues,
      [event.target.name]: event.target.value
    });
  };

  const handleSaveButtonClick = (inputName) => {
    console.log(`Saved value of ${inputName}: ${inputValues[inputName]}`);
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p className="App-link" rel="noopener noreferrer">
          Notifly js SDK example react app
        </p>
        <button onClick={() => handleButtonClick("Button 1")}>Button 1</button>
        <button onClick={() => handleButtonClick("Button 2")}>Button 2</button>
        <input
          type="text"
          name="input1"
          value={inputValues.input1}
          onChange={handleInputChange}
          placeholder="Input 1"
        />
        <button onClick={() => handleSaveButtonClick("input1")}>Save Input 1</button>
        <input
          type="text"
          name="input2"
          value={inputValues.input2}
          onChange={handleInputChange}
          placeholder="Input 2"
        />
        <button onClick={() => handleSaveButtonClick("input2")}>Save Input 2</button>

      </header>
    </div>
  );
}

export default App;
