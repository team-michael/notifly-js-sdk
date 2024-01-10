import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';

import notifly from 'notifly-js-sdk';
import logo from './logo.svg';
import './App.css';
import Playground from './Playground';

function App() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            notifly.trackEvent('hello', { from: 'react' });
            notifly.trackEvent('hello2', { from: 'react' });
            notifly.initialize({
                projectId: process.env.REACT_APP_NOTIFLY_PROJECT_ID,
                username: process.env.REACT_APP_NOTIFLY_USERNAME,
                password: process.env.REACT_APP_NOTIFLY_PASSWORD,
            });
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
            <UserPropertySetter />
            <TrackEventSection />
            <RemoveUserIdButton />
            <DeleteUserIdButton />
            <Link to="/playground">Go to playground</Link>
            <Outlet />
        </div>
    );
}

function TrackEventSection() {
    const eventParamsRef = useRef(null);
    const [eventName, setEventName] = useState('');

    return (
        <div style={{ margin: '10px' }}>
            <input
                type="text"
                placeholder="Event Name"
                onChange={(e) => {
                    setEventName(e.target.value);
                }}
                value={eventName}
            />
            <textarea ref={eventParamsRef} placeholder="Event Params (JSON)" />
            <button
                onClick={() => {
                    let eventParams = {};
                    if (eventParamsRef.current.value) {
                        try {
                            eventParams = JSON.parse(eventParamsRef.current.value);
                        } catch (e) {
                            alert('Invalid JSON');
                            console.error(e);
                        }
                    }
                    notifly.trackEvent(eventName, eventParams).then(() => {
                        console.log(
                            `Event ${eventName} tracked successfully with params ${JSON.stringify(eventParams)}`
                        );
                    });
                }}
            >
                Track Event
            </button>
        </div>
    );
}

function UserIdSetter() {
    const [userIdInput, setUserIdInput] = useState('');

    const handleInputChange = (event) => {
        setUserIdInput(event.target.value);
    };

    const handleSetUserId = () => {
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

function UserPropertySetter() {
    const keyRef = useRef(null);
    const [value, setValue] = useState('');

    const valueTypeOptions = [
        { value: 'TEXT', label: 'Text' },
        { value: 'INT', label: 'Integer' },
        { value: 'BOOL', label: 'Boolean' },
        { value: 'ARRAY', label: 'Array' },
    ];
    const [valueType, setValueType] = useState(valueTypeOptions[0].value);

    useEffect(() => {
        if (valueType === 'TEXT') {
            setValue('');
        } else if (valueType === 'INT') {
            setValue(0);
        } else if (valueType === 'BOOL') {
            setValue(true);
        } else if (valueType === 'ARRAY') {
            setValue([]);
        }
    }, [valueType]);

    return (
        <div>
            <div style={{ margin: '10px' }}>
                <input type="text" name="setUserId" ref={keyRef} placeholder="key" />
                {valueType === 'TEXT' ? (
                    <input
                        type="text"
                        name="setUserId"
                        placeholder="value"
                        onChange={(e) => {
                            setValue(e.target.value);
                        }}
                        value={value}
                    />
                ) : valueType === 'INT' ? (
                    <input
                        type="number"
                        name="setUserId"
                        placeholder="value"
                        onChange={(e) => {
                            const parsedValue = parseInt(e.target.value);
                            if (isNaN(parsedValue)) {
                                setValue(0);
                            } else {
                                setValue(parsedValue);
                            }
                        }}
                        value={value}
                    />
                ) : valueType === 'BOOL' ? (
                    <select
                        onChange={(e) => {
                            setValue(e.target.value === 'true');
                        }}
                        value={value ? 'true' : 'false'}
                    >
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                ) : (
                    <input
                        type="text"
                        placeholder="value"
                        onChange={(e) => {
                            setValue(e.target.value.split(',').map((v) => v.trim()));
                        }}
                        value={Array.isArray(value) ? value.join(', ') : value}
                    />
                )}
                <select onChange={(e) => setValueType(e.target.value)}>
                    {valueTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => {
                        notifly.setUserProperties({
                            [keyRef.current.value]: value,
                        });
                    }}
                >
                    Set User Property
                </button>
            </div>
            {valueType === 'ARRAY' && (
                <p
                    style={{
                        fontSize: '12px',
                        color: '#999',
                    }}
                >
                    Please separate array values with commas
                </p>
            )}
        </div>
    );
}

function RemoveUserIdButton() {
    const handleClick = () => {
        notifly.setUserId();
    };

    return (
        <div style={{ margin: '10px' }}>
            <button onClick={handleClick}>Remove User Id</button>
        </div>
    );
}

function DeleteUserIdButton() {
    const handleClick = () => {
        notifly.deleteUser();
    };

    return (
        <div style={{ margin: '10px' }}>
            <button onClick={handleClick}>Delete User Id</button>
        </div>
    );
}

export default App;
