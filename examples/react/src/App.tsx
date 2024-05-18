import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';

import notifly from './lib/notifly';
import logo from './logo.svg';
import './App.css';
import Playground from './Playground';
import MyPage from './MyPage';
import NotiflyIndexedDBStore from './lib/notifly/Core/Storage/IDB';

const storage = new NotiflyIndexedDBStore('notifly', 'notiflyconfig');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
    const [initStatus, setInitStatus] = useState('Initializing...');
    const [setUserIdStatus, setSetUserIdStatus] = useState('');
    const [setUserPropertiesStatus, setSetUserPropertiesStatus] = useState('');
    const [trackEventStatus, setTrackEventStatus] = useState('');

    const initialize = async () => {
        try {
            await notifly.initialize({
                projectId: process.env.REACT_APP_NOTIFLY_PROJECT_ID as string,
                username: process.env.REACT_APP_NOTIFLY_USERNAME as string,
                password: process.env.REACT_APP_NOTIFLY_PASSWORD as string,
            });
            setInitStatus('Initialized');
            console.log('SDK Initialized');
        } catch (e) {
            setInitStatus(`Failed to initialize: ${e}`);
            console.error('Failed to initialize SDK', e);
        }
    };

    const setUserId = async (userId: string) => {
        try {
            await notifly.setUserId(userId);
            setSetUserIdStatus(`User Id Set to ${userId}`);
            console.log(`User Id Set to ${userId}`);
        } catch (e) {
            setSetUserIdStatus(`Failed to set user id: ${e}`);
            console.error('Failed to set user id', e);
        }
    };

    const setUserProperties = async (properties: { [key: string]: string | number | boolean | string[] }) => {
        try {
            await notifly.setUserProperties(properties);
            setSetUserPropertiesStatus(`User Properties Set to ${JSON.stringify(properties)}`);
            console.log(`User Properties Set to ${JSON.stringify(properties)}`);
        } catch (e) {
            setSetUserPropertiesStatus(`Failed to set user properties: ${e}`);
            console.error('Failed to set user properties', e);
        }
    };

    const trackEvent = async (
        eventName: string,
        eventParams?: { [key: string]: string | number | boolean | string[] }
    ) => {
        try {
            await notifly.trackEvent(eventName, eventParams);
            setTrackEventStatus(`Event ${eventName} tracked with params ${JSON.stringify(eventParams)}`);
            console.log(`Event ${eventName} tracked with params ${JSON.stringify(eventParams)}`);
        } catch (e) {
            setTrackEventStatus(`Failed to track event: ${e}`);
            console.error('Failed to track event', e);
        }
    };

    const test = async () => {
        initialize();
        // for (let i = 0; i < 5; i++) {
        //     for (let j = 0; j < 5; j++) {
        //         trackEvent(`test_event_${i}_${j}`);
        //     }
        //     setUserId(`test_user_${i}`);
        // }
    };

    useEffect(() => {
        initialize();
    }, []);

    useEffect(() => {
        test();
    }, []);

    return (
        <div className="App">
            <StatusPanel {...{ initStatus, setUserIdStatus, setUserPropertiesStatus, trackEventStatus }} />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="playground" element={<Playground />} />
                <Route path="mypage" element={<MyPage />} />
            </Routes>
        </div>
    );
}

function StatusPanel({
    initStatus,
    setUserIdStatus,
    setUserPropertiesStatus,
    trackEventStatus,
}: {
    initStatus: string;
    setUserIdStatus: string;
    setUserPropertiesStatus: string;
    trackEventStatus: string;
}) {
    return (
        <div>
            <p>Init Status: {initStatus}</p>
            <p>SetUserId Status: {setUserIdStatus}</p>
            <p>SetUserProperties Status: {setUserPropertiesStatus}</p>
            <p>TrackEvent Status: {trackEventStatus}</p>
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
            <UserIdGetter />
            <IndexedDBDumper />
            <UserPropertySetter />
            <TrackEventSection />
            <RemoveUserIdButton />
            <Link
                to="/playground"
                style={{
                    color: '#61dafb',
                    textDecoration: 'none',
                    fontSize: '12px',
                    marginTop: '10px',
                }}
            >
                Go to playground
            </Link>
            <button
                onClick={() => {
                    window.location.href = '/playground';
                }}
                style={{
                    color: '#61dafb',
                    textDecoration: 'none',
                    fontSize: '12px',
                    marginTop: '10px',
                }}
            >
                Go to playground (hard)
            </button>
            <Outlet />
        </div>
    );
}

function IndexedDBDumper() {
    const [keyName, setKeyName] = useState('');
    const [value, setValue] = useState('');

    const handleDump = async () => {
        const value = await storage.getItem(keyName);
        let displayValue = value;
        try {
            displayValue = JSON.stringify(JSON.parse(value as string), null, 2);
        } catch (e) {}
        setValue(displayValue as string);
    };

    return (
        <div>
            <input type="text" placeholder="Key" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <button onClick={handleDump}>Dump</button>
            <pre
                style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '12px',
                    maxWidth: '500px',
                    textAlign: 'left',
                }}
            >
                {value}
            </pre>
        </div>
    );
}

function UserIdGetter() {
    const [id, setId] = useState('');
    const handleGetUserId = async () => {
        const value = await notifly.getUserId();
        setId(value || '[Not Exists]');
    };

    return (
        <div>
            <button onClick={handleGetUserId}>Check User Id</button>
            <pre
                style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '12px',
                    maxWidth: '500px',
                    textAlign: 'left',
                }}
            >
                {id}
            </pre>
        </div>
    );
}

function TrackEventSection() {
    const eventParamsRef = useRef<HTMLTextAreaElement>(null);
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
                    if (eventParamsRef.current && eventParamsRef.current.value) {
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
    const [onlyIfChanged, setOnlyIfChanged] = useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUserIdInput(event.target.value);
    };

    const handleSetUserId = () => {
        if (!userIdInput) {
            return;
        }
        notifly
            .setUserId(userIdInput, { onlyIfChanged })
            .then(() => console.log(`Set user id to ${userIdInput}, onlyIfChanged: ${onlyIfChanged}`));
    };
    const handleRemoveUserId = () => {
        notifly.removeUserId({ onlyIfChanged }).then(() => console.log('Removed user id'));
    };

    return (
        <div style={{ margin: '10px' }}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'end',
                }}
            >
                <label
                    htmlFor="checkbox-only-if-changed"
                    style={{
                        fontSize: '12px',
                        color: '#999',
                    }}
                >
                    Only if changed
                </label>
                <input
                    id="checkbox-only-if-changed"
                    type="checkbox"
                    onChange={(e) => setOnlyIfChanged(e.target.checked)}
                    checked={onlyIfChanged}
                />
            </div>
            <div>
                <input
                    type="text"
                    name="setUserId"
                    value={userIdInput}
                    onChange={handleInputChange}
                    placeholder="user id"
                />
                <button onClick={handleSetUserId}>Set User Id</button>
            </div>
            <div>
                <button onClick={handleRemoveUserId}>Remove User Id</button>
            </div>
        </div>
    );
}

function UserPropertySetter() {
    const keyRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState<string | string[] | number | boolean>('');

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
                        value={value.toString()}
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
                        value={value.toString()}
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
                        value={Array.isArray(value) ? value.join(', ') : value.toString()}
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
                        if (keyRef.current) {
                            notifly.setUserProperties({
                                [keyRef.current.value]: value,
                            });
                        }
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

export default App;
