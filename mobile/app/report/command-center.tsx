import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { usePeraWallet } from '../../contexts/PeraWalletContext';
import { getCoastalIntelligence } from '../../services/x402/coastalIntelligence';
import { api } from '../../services/api';
import { isInlandRegion } from '../../utils/regionUtils';
import {
  ArrowLeft,
  Send,
  Sparkles,
  MessageSquare,
  Waves
} from 'lucide-react-native';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const PRESETS = [
  "Summarize today's threats",
  "Check oil spill status",
  "Check flood warnings"
];

export default function AICommandCenter() {
  const { user } = useAuth();
  const { address, isConnected, connect } = usePeraWallet();
  const { theme } = useTheme();
  const { prefill } = useLocalSearchParams();

  const colors = Theme[theme];
  const activeRegion = user?.region || 'India';

  const isInlandUser = isInlandRegion(activeRegion);

  const DYNAMIC_PRESETS = isInlandUser
    ? [
        "Summarize today's threats",
        "Ganga river status",
        "Check flood warnings"
      ]
    : [
        "Summarize today's threats",
        "Check oil spill status",
        "Check flood warnings"
      ];

  const assistantName = isInlandUser
    ? 'RiverTwin Command Assistant'
    : 'SentinelSea Command Assistant';

  const welcomeContext = isInlandUser
    ? `river floods, Ganga water levels, and inland hazard alerts`
    : `active hazards, oil spill forecasts, or flood warnings`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am the **${assistantName}**.\n\nAsk me about today's ${welcomeContext} in the **${activeRegion}** region.`,
      timestamp: new Date()
    }
  ]);

  const [inputText, setInputText] = useState(
    (prefill as string) || ''
  );

  const [isSending, setIsSending] = useState(false);

  const [isLoadingIntelligence, setIsLoadingIntelligence] =
    useState(false);

  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    setTimeout(
      () =>
        flatListRef.current?.scrollToEnd({
          animated: true
        }),
      100
    );

    try {
      const response = await api.post<{ reply: string }>(
        '/api/ai/chat',
        {
          question: textToSend,
          region: activeRegion
        }
      );

      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        text: response.reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        text:
          'Sorry, I was unable to reach the Sentinel Command Server. Please verify your connection.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);

      setTimeout(
        () =>
          flatListRef.current?.scrollToEnd({
            animated: true
          }),
        100
      );
    }
  };

  const runCoastalIntelligence = async () => {
    try {
      setIsLoadingIntelligence(true);

      let walletAddress = address;

      if (!isConnected || !walletAddress) {
        walletAddress = await connect();
      }

      const result = await getCoastalIntelligence(
        activeRegion,
        walletAddress
      );

      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        text:
          typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);

      setTimeout(
        () =>
          flatListRef.current?.scrollToEnd({
            animated: true
          }),
        100
      );
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        text: `Coastal Intelligence unavailable: ${
          error?.message || 'Unknown error'
        }`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMsg]);

      setTimeout(
        () =>
          flatListRef.current?.scrollToEnd({
            animated: true
          }),
        100
      );
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: colors.background
        }
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.surface
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Sparkles
            size={16}
            color={colors.accent}
            style={{ marginRight: 6 }}
          />

          <Text
            style={[
              styles.headerTitle,
              {
                color: colors.text
              }
            ]}
          >
            AI War Room Command
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
        keyboardVerticalOffset={
          Platform.OS === 'ios'
            ? 0
            : 24
        }
      >
        {/* Chat List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={
            styles.chatPadding
          }
          renderItem={({ item }) => {
            const isAI =
              item.sender === 'ai';

            return (
              <View
                style={[
                  styles.msgWrapper,
                  isAI
                    ? {
                        alignSelf:
                          'flex-start'
                      }
                    : {
                        alignSelf:
                          'flex-end'
                      }
                ]}
              >
                <View
                  style={[
                    styles.msgBubble,
                    isAI
                      ? {
                          backgroundColor:
                            colors.surface,
                          borderTopLeftRadius: 4
                        }
                      : {
                          backgroundColor:
                            colors.accent,
                          borderTopRightRadius: 4
                        }
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isAI
                        ? {
                            color: colors.text
                          }
                        : {
                            color: '#FFFFFF'
                          }
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>

                <Text
                  style={styles.timeLabel}
                >
                  {item.timestamp.toLocaleTimeString(
                    [],
                    {
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )}
                </Text>
              </View>
            );
          }}
        />

        {/* Coastal Intelligence Button */}
        <View
          style={[
            styles.intelligenceWrapper,
            {
              backgroundColor:
                colors.background
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles.intelligenceButton,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.primary
              }
            ]}
            onPress={
              runCoastalIntelligence
            }
            disabled={
              isLoadingIntelligence ||
              isSending
            }
          >
            {isLoadingIntelligence ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Waves
                size={17}
                color={colors.primary}
              />
            )}

            <View
              style={
                styles.intelligenceTextWrapper
              }
            >
              <Text
                style={[
                  styles.intelligenceTitle,
                  {
                    color: colors.text
                  }
                ]}
              >
                Coastal Intelligence
              </Text>

              <Text
                style={[
                  styles.intelligenceSubtitle,
                  {
                    color: '#94A3B8'
                  }
                ]}
              >
                0.01 ALGO • Live analysis
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preset Prompt Suggestions */}
        <View
          style={[
            styles.presetsWrapper,
            {
              borderTopColor:
                colors.border
            }
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.presetsScroll
            }
          >
            {DYNAMIC_PRESETS.map(
              (p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor:
                        colors.surface,
                      borderColor:
                        colors.border
                    }
                  ]}
                  onPress={() =>
                    sendMessage(p)
                  }
                  disabled={
                    isSending ||
                    isLoadingIntelligence
                  }
                >
                  <MessageSquare
                    size={13}
                    color={
                      colors.primary
                    }
                    style={{
                      marginRight: 6
                    }}
                  />

                  <Text
                    style={[
                      styles.presetText,
                      {
                        color:
                          colors.text
                      }
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>

        {/* Footer Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor:
                colors.surface,
              borderTopColor:
                colors.border
            }
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor:
                  colors.background,
                color: colors.text,
                borderColor:
                  colors.border
              }
            ]}
            placeholder="Ask Command Assistant..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={
              setInputText
            }
            editable={
              !isSending &&
              !isLoadingIntelligence
            }
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  colors.primary
              }
            ]}
            onPress={() =>
              sendMessage(inputText)
            }
            disabled={
              isSending ||
              isLoadingIntelligence ||
              !inputText.trim()
            }
          >
            {isSending ? (
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <Send
                size={18}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1
  },

  backBtn: {
    padding: 6
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700'
  },

  chatPadding: {
    padding: 16,
    paddingBottom: 24
  },

  msgWrapper: {
    marginBottom: 16,
    maxWidth: '80%'
  },

  msgBubble: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },

  msgText: {
    fontSize: 14,
    lineHeight: 20
  },

  timeLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    alignSelf: 'flex-end',
    fontWeight: '600'
  },

  intelligenceWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8
  },

  intelligenceButton: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },

  intelligenceTextWrapper: {
    marginLeft: 10,
    flex: 1
  },

  intelligenceTitle: {
    fontSize: 14,
    fontWeight: '700'
  },

  intelligenceSubtitle: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600'
  },

  presetsWrapper: {
    paddingVertical: 10,
    borderTopWidth: 1
  },

  presetsScroll: {
    paddingHorizontal: 16
  },

  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },

  presetText: {
    fontSize: 11,
    fontWeight: '700'
  },

  inputBar: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    paddingBottom:
      Platform.OS === 'ios'
        ? 12
        : 0
  },

  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontSize: 14
  },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  }
});
