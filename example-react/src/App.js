import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';

import notifly from 'notifly-js-sdk-dev';
import logo from './logo.svg';
import './App.css';
import Playground from './Playground';

function App() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            notifly.initialize(
                process.env.REACT_APP_NOTIFLY_PROJECT_ID,
                process.env.REACT_APP_NOTIFLY_USERNAME,
                process.env.REACT_APP_NOTIFLY_PASSWORD
            );
        }
    }, []);

    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="playground" element={<Playground />} />
            </Routes>
        </div>
    );
}

function HomePage() {
    return (
        <div className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <p className="App-link" rel="noopener noreferrer">
                Notifly js SDK example react app
            </p>
            <UserIdSetter />
            <EventButton name="event_react_1" />
            <EventButton name="event_react_2" />
            <EventButton name="event_react_3" />
            <EventButton name="event_react_4" />
            <EventButton name="event_react_5" />
            <EventButton name="event_react_6" />
            <Link to="/playground">Go to playground</Link>
            <Outlet />
        </div>
    );
}

function EventButton({ name }) {
    const handleButtonClick = (buttonName) => {
        notifly.trackEvent(buttonName);
        console.log(`Button ${buttonName} clicked`);
    };
    return (
        <button style={{ margin: '10px' }} onClick={() => handleButtonClick(name)}>
            {name}
        </button>
    );
}

function UserIdSetter() {
    const [userIdInput, setUserIdInput] = useState('');

    const handleInputChange = (event) => {
        setUserIdInput(event.target.value);
    };

    const handleSetUserId = () => {
        console.log(userIdInput)
        notifly.setUserId(userIdInput);
        console.log(`Set user id to ${userIdInput}`);
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
