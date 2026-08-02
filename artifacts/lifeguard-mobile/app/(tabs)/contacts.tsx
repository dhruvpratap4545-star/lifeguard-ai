import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import {
  useListContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
  getListContactsQueryKey,
} from '@workspace/api-client-react';
import type { Contact } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const WEB_TOP_INSET = 67;

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [formError, setFormError] = useState('');

  const { data: contacts, isLoading, refetch } = useListContacts();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();

  const handleAddContact = useCallback(async () => {
    if (!name.trim() || !phone.trim() || !relationship.trim()) {
      setFormError('All fields are required.');
      return;
    }
    setFormError('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createContact.mutate(
      { data: { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() } },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
          setRelationship('');
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        },
        onError: () => {
          setFormError('Failed to add contact. Try again.');
        },
      },
    );
  }, [name, phone, relationship, createContact, queryClient]);

  const handleDelete = useCallback(
    (contact: Contact) => {
      Alert.alert(
        'Remove Contact',
        `Remove ${contact.name} from emergency contacts?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              deleteContact.mutate(
                { id: contact.id },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
                  },
                },
              );
            },
          },
        ],
      );
    },
    [deleteContact, queryClient],
  );

  const handleTogglePrimary = useCallback(
    (contact: Contact) => {
      updateContact.mutate(
        { id: contact.id, data: { isPrimary: !contact.isPrimary } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          },
        },
      );
    },
    [updateContact, queryClient],
  );

  const topPad = isWeb ? WEB_TOP_INSET : insets.top + 16;
  const styles = makeStyles(colors);

  const initials = (n: string) =>
    n
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Contacts</Text>
        <Pressable
          onPress={() => setShowForm((v) => !v)}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: showForm ? colors.secondary : colors.primary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Add Form */}
      {showForm && (
        <KeyboardAwareScrollViewCompat
          style={[styles.form, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.formTitle, { color: colors.foreground }]}>New Contact</Text>
          {formError ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{formError}</Text>
          ) : null}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          />
          <TextInput
            value={relationship}
            onChangeText={setRelationship}
            placeholder="Relationship (e.g. Spouse, Friend)"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          />
          <Pressable
            onPress={handleAddContact}
            disabled={createContact.isPending}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: pressed || createContact.isPending ? 0.7 : 1 },
            ]}
          >
            {createContact.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Add Contact</Text>
            )}
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      )}

      {/* Contact List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={contacts ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: isWeb ? 34 : insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(contacts && contacts.length > 0)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="users" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No contacts yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Add emergency contacts who will be notified during an alert.
              </Text>
            </View>
          }
          renderItem={({ item: contact }) => (
            <View
              style={[
                styles.contactCard,
                {
                  backgroundColor: colors.card,
                  borderColor: contact.isPrimary ? colors.primary : colors.border,
                  borderWidth: contact.isPrimary ? 1.5 : 1,
                },
              ]}
            >
              {/* Avatar */}
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: contact.isPrimary ? `${colors.primary}33` : colors.secondary },
                ]}
              >
                <Text style={[styles.avatarText, { color: contact.isPrimary ? colors.primary : colors.foreground }]}>
                  {initials(contact.name)}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.contactInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.contactName, { color: colors.foreground }]}>{contact.name}</Text>
                  {contact.isPrimary && (
                    <View style={[styles.primaryBadge, { backgroundColor: `${colors.primary}22` }]}>
                      <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.contactPhone, { color: colors.mutedForeground }]}>{contact.phone}</Text>
                <Text style={[styles.contactRel, { color: colors.mutedForeground }]}>{contact.relationship}</Text>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleTogglePrimary(contact)}
                  style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons
                    name={contact.isPrimary ? 'star' : 'star-outline'}
                    size={20}
                    color={contact.isPrimary ? colors.warning : colors.mutedForeground}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(contact)}
                  style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      borderBottomWidth: 1,
    },
    formTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    errorText: {
      fontSize: 13,
    },
    input: {
      height: 46,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    submitBtn: {
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    submitBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      gap: 10,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 12,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
    },
    contactInfo: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    contactName: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    primaryBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    contactPhone: {
      fontSize: 13,
    },
    contactRel: {
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      gap: 4,
    },
    actionBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
