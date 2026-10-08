import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface UserProfileHeaderProps {
  onSignOut?: () => void;
}

export function UserProfileHeader({ onSignOut }: UserProfileHeaderProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const displayName = user.name || user.username;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      logout();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileLeft}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: user.avatarColor || '#3B82F6' },
          ]}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.loggedInAs}>Logged in as:</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  loggedInAs: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  username: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  email: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
