import { View, Linking, Dimensions } from 'react-native';
import RootSiblings from 'react-native-root-siblings';
import Modal from 'react-native-modal';
import WebView from 'react-native-webview';
import logEvent from './log_event';
import { setUserProperties } from './user';

/**
 * Displays an in-app message in a modal WebView.
 *
 * @async
 * @param {Object} data - An object containing information about the in-app message to display.
 * @param {Object} openedInAppWebViewCount - An object containing the count of opened in-app web views.
 * @returns {Promise<void>} A promise that resolves when the in-app message has been displayed, or rejects with an error.
 *
 * @example
 * const data = { campaign_id: 'myCampaign', url: 'https://example.com' };
 * const openedInAppWebViewCount = { count: 0 };
 * await showInAppMessage(data, openedInAppWebViewCount);
 */
export async function showInAppMessage(data, openedInAppWebViewCount) {
    if (openedInAppWebViewCount.count > 0) {
        return;
    }
    if (!(data?.url && data?.modal_properties)) {
        return;
    }
    const modalProperties = data.modal_properties || {};
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const webViewProps = _translateWebviewProps(modalProperties, screenWidth, screenHeight);
    const link = data.url; // default html link for only testing.
    const injectedJavaScript = `
        const button_trigger = document.getElementById('notifly-button-trigger');
        button_trigger.addEventListener('click', function(event){
            if (!event.notifly_button_click_type) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: event.notifly_button_click_type,
                button_name: event.notifly_button_name,
                link: event.notifly_button_click_link,
            }));
        });
    `;

    const webviewMessageHandler = (e) => {
        const message = JSON.parse(e.nativeEvent.data);
        if (message.type === 'close') {
            modal.destroy();
            openedInAppWebViewCount.count = openedInAppWebViewCount.count - 1;
            logEvent(
                'close_button_click',
                {
                    type: 'message_event',
                    channel: 'in-app-message',
                    button_name: message.button_name,
                    campaign_id: data.campaign_id,
                    notifly_message_id: data.notifly_message_id,
                },
                null,
                true
            );
        } else if (message.type === 'main_button') {
            logEvent(
                'main_button_click',
                {
                    type: 'message_event',
                    channel: 'in-app-message',
                    button_name: message.button_name,
                    campaign_id: data.campaign_id,
                    notifly_message_id: data.notifly_message_id,
                },
                null,
                true
            );
            if (message.link) {
                modal.destroy();
                openedInAppWebViewCount.count = openedInAppWebViewCount.count - 1;
                Linking.openURL(message.link);
            }
        } else if (message.type === 'hide_in_app_message') {
            modal.destroy();
            openedInAppWebViewCount.count = openedInAppWebViewCount.count - 1;
            logEvent(
                'hide_in_app_message_button_click',
                {
                    type: 'message_event',
                    channel: 'in-app-message',
                    button_name: message.button_name,
                    campaign_id: data.campaign_id,
                    notifly_message_id: data.notifly_message_id,
                },
                null,
                true
            );
            if (modalProperties.template_name) {
                const key = `hide_in_app_message_${modalProperties.template_name}`;
                setUserProperties({
                    [key]: true,
                });
            }
        }
    };

    openedInAppWebViewCount.count = openedInAppWebViewCount.count + 1;
    logEvent(
        'in_app_message_show',
        { type: 'message_event', channel: 'in-app-message', campaign_id: data.campaign_id, notifly_message_id: data.notifly_message_id },
        null,
        true
    ); // logging in app messaging delivered
    const modal = new RootSiblings(
        (
            <Modal
                isVisible={true}
                transparent={true}
                onBackdropPress={() => {
                    openedInAppWebViewCount.count = openedInAppWebViewCount.count - 1;
                    modal.destroy();
                }}
                onBackButtonPress={() => {
                    openedInAppWebViewCount.count = openedInAppWebViewCount.count - 1;
                    modal.destroy();
                }}
                backdropOpacity={0}
                style={webViewProps.modalStyle}
            >
                <View>
                    <View style={webViewProps.viewStyle}>
                        <WebView
                            originWhitelist={['*']}
                            source={{
                                uri: link,
                            }}
                            style={{
                                width: screenWidth,
                                height: screenHeight,
                            }}
                            onMessage={webviewMessageHandler}
                            javaScriptEnabled={true}
                            injectedJavaScript={injectedJavaScript}
                        />
                    </View>
                </View>
            </Modal>
        )
    );
}

function _translateWebviewProps(modalProps, screenWidth, screenHeight) {
    const modalStyle = {
        margin: 0,
        justifyContent: 'center',
        alignItems: 'center',
        ...(modalProps?.position === 'bottom' && {
            position: 'absolute',
            bottom: 0,
        }),
    };

    const viewStyle = {
        borderTopLeftRadius: modalProps?.borderTopLeftRadius || 0,
        borderTopRightRadius: modalProps?.borderTopRightRadius || 0,
        borderBottomLeftRadius: modalProps?.borderBottomLeftRadius || 0,
        borderBottomRightRadius: modalProps?.borderBottomRightRadius || 0,
        overflow: 'hidden',
        width: _getViewWidth(modalProps, screenWidth, screenHeight),
        height: _getViewHeight(modalProps, screenWidth, screenHeight),
        justifyContent: 'center',
        alignItems: 'center',
    };

    return {
        modalStyle,
        viewStyle,
    };
}

function _getViewWidth(modalProps, screenWidth, screenHeight) {
    let viewWidth;

    if (modalProps.width) {
        viewWidth = modalProps.width;
    } else if (!screenWidth) {
        console.error('screenWidth is not defined');
        viewWidth = '100%';
    } else if (modalProps.width_vw) {
        viewWidth = screenWidth * (modalProps.width_vw / 100);
    } else if (modalProps.width_vh && screenHeight) {
        viewWidth = screenHeight * (modalProps.width_vh / 100);
    } else {
        viewWidth = '100%';
    }

    if (modalProps.min_width && viewWidth < modalProps.min_width) {
        viewWidth = modalProps.minWidth;
    }
    if (modalProps.max_width && viewWidth > modalProps.max_width) {
        viewWidth = modalProps.maxWidth;
    }

    return viewWidth;
}

function _getViewHeight(modalProps, screenWidth, screenHeight) {
    let viewHeight;

    if (modalProps.height) {
        viewHeight = modalProps.height;
    } else if (!screenHeight) {
        console.error('screenHeight is not defined');
        viewHeight = '100%';
    } else if (modalProps.height_vh) {
        viewHeight = screenHeight * (modalProps.height_vh / 100);
    } else if (modalProps.height_vw && screenWidth) {
        viewHeight = screenWidth * (modalProps.height_vw / 100);
    } else {
        viewHeight = '100%';
    }

    if (modalProps.min_height && viewHeight < modalProps.min_height) {
        viewHeight = modalProps.min_height;
    }
    if (modalProps.max_height && viewHeight > modalProps.max_height) {
        viewHeight = modalProps.max_height;
    }

    return viewHeight;
}
