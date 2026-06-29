import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, Dimensions, TextInput } from 'react-native';
import { Box, Text } from '@/src/services/config';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { translate } from '@/src/services/ai/ghanaNLP';

const ALERTS = [
  {
    id: '1',
    title: 'Proverb of the Day',
    content: '"Obi nnim a, obi kyerɛ."',
    translation: 'If someone does not know, someone else teaches him.',
    lang: 'Akan (Twi)',
    icon: 'chatbubble-ellipses-outline',
    color: '#FF9500'
  },
  {
    id: '2',
    title: 'Did you know?',
    content: 'Twi is spoken by over 9 million people in Ghana as a first and second language.',
    icon: 'bulb-outline',
    color: '#007AFF'
  }
];

const QUICK_LINKS = [
  { id: '1', name: 'Translator', icon: 'language', color: '#34C759' },
  { id: '2', name: 'Dictionary', icon: 'book-outline', color: '#5856D6' },
  { id: '3', name: 'Culture', icon: 'map-outline', color: '#AF52DE' },
  { id: '4', name: 'Voices', icon: 'mic-outline', color: '#FF2D55' },
];

export default function AssistantScreen() {
  const [quickSearch, setQuickSearch] = useState('');
  const [translationResult, setTranslationResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleQuickTranslate = async () => {
    if (!quickSearch) return;
    try {
      setIsTranslating(true);
      const result = await translate(quickSearch, 'English', 'Akan (Twi)');
      setTranslationResult(result);
    } catch (error) {
      console.error('Quick translate failed:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Box flex={1} backgroundColor="background" padding="medium">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop="large" marginBottom="medium">
          <Box>
            <Text variant="heading2">Talkii Assistant</Text>
            <Text variant="body" color="textSecondary">Your gateway to Ghanaian languages</Text>
          </Box>
          <TouchableOpacity>
            <Box backgroundColor="backgroundSecondary" padding="small" borderRadius="round">
              <Ionicons name="notifications-outline" size={24} color="#666" />
            </Box>
          </TouchableOpacity>
        </Box>

        {/* Proverb/Alert Carousel (Mock) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={Dimensions.get('window').width - 40} decelerationRate="fast">

          {ALERTS.map((alert) => (
            <Box 
              key={alert.id}
              width={Dimensions.get('window').width - 60}
              backgroundColor="backgroundSecondary"
              padding="medium"
              borderRadius="lg"
              marginRight="small"
              style={styles.cardShadow}
            >
              <Box flexDirection="row" alignItems="center" marginBottom="small">
                <Ionicons name={alert.icon as any} size={20} color={alert.color} />
                <Text variant="body" fontWeight="bold" marginLeft="small" style={{ color: alert.color }}>
                  {alert.title}
                </Text>
              </Box>
              <Text variant="body" fontSize={18} fontWeight="600" marginBottom="small">

                {alert.content}
              </Text>
              {alert.translation && (
                <Text variant="body" color="textSecondary" fontStyle="italic">
                  {alert.translation}
                </Text>
              )}
            </Box>
          ))}
        </ScrollView>

        {/* Quick Translate Widget */}
        <Box marginTop="xl" backgroundColor="backgroundSecondary" padding="medium" borderRadius="lg" style={styles.cardShadow}>
          <Text variant="body" fontWeight="bold" marginBottom="small">Quick Translation (EN &rarr; TWI)</Text>
          <Box flexDirection="row" alignItems="center" backgroundColor="background" borderRadius="md" paddingHorizontal="small">
            <TextInput
              style={styles.input}
              placeholder="Enter English text..."
              placeholderTextColor="#999"
              value={quickSearch}
              onChangeText={setQuickSearch}
              editable={!isTranslating}
            />
            <TouchableOpacity onPress={handleQuickTranslate} disabled={isTranslating}>
              <Box backgroundColor={isTranslating ? 'backgroundSecondary' : 'primary'} padding="small" borderRadius="md">
                <Ionicons name={isTranslating ? 'sync-outline' : 'arrow-forward'} size={20} color="white" />
              </Box>
            </TouchableOpacity>
          </Box>
          {translationResult && (
            <Box marginTop="small" padding="small" backgroundColor="background" borderRadius="md">
              <Text variant="body" color="primary">{translationResult}</Text>
            </Box>
          )}
        </Box>

        {/* Quick Links Grid */}
        <Box marginTop="xl" flexDirection="row" flexWrap="wrap" justifyContent="space-between">
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity key={link.id} style={styles.gridItem}>
              <Box 
                backgroundColor="backgroundSecondary" 
                padding="medium" 
                borderRadius="lg" 
                alignItems="center" 
                justifyContent="center"
                style={styles.cardShadow}
              >
                <Box 
                  width={40} 
                  height={40} 
                  borderRadius="round" 
                  backgroundColor="background" 
                  alignItems="center" 
                  justifyContent="center"
                  marginBottom="small"
                >
                  <MaterialCommunityIcons name={link.icon as any} size={24} color={link.color} />
                </Box>
                <Text variant="body" fontSize={12} fontWeight="bold">{link.name}</Text>
              </Box>
            </TouchableOpacity>
          ))}
        </Box>

        {/* Footer Info */}
        <Box marginTop="xl" padding="medium" backgroundColor="primary" borderRadius="lg" marginBottom="xl">
          <Text color="white" variant="heading2" marginBottom="small">Explore more</Text>
          <Text color="white" variant="body" fontSize={14} opacity={0.9}>
            Learn about the rich history of Ghana&apos;s linguistic diversity and how it shapes our communication today.
          </Text>

          <TouchableOpacity style={styles.button}>
            <Text variant="body" fontWeight="bold" color="primary">Read More</Text>
          </TouchableOpacity>
        </Box>
      </ScrollView>
    </Box>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  button: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  }
});

