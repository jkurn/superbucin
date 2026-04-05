import { supabase } from './supabaseClient.js';
import { AVATARS } from './ui/constants.js';

const ADJECTIVES = [
  'Sleepy', 'Spicy', 'Fluffy', 'Sneaky', 'Wobbly', 'Turbo', 'Cosmic',
  'Dizzy', 'Crunchy', 'Funky', 'Mighty', 'Chonky', 'Zappy', 'Fizzy',
  'Sparkly', 'Bouncy', 'Squishy', 'Toasty', 'Peppy', 'Goofy', 'Jazzy',
  'Zippy', 'Breezy', 'Crispy', 'Dazzling', 'Wacky', 'Snappy', 'Bubbly',
  'Nifty', 'Quirky', 'Wiggly', 'Swoopy', 'Groovy', 'Ticklish', 'Pudgy',
];

const NOUNS = [
  'Pancake', 'Nugget', 'Pickle', 'Waffle', 'Noodle', 'Muffin', 'Taco',
  'Biscuit', 'Pretzel', 'Dumpling', 'Cupcake', 'Donut', 'Potato', 'Cookie',
  'Burrito', 'Sushi', 'Popcorn', 'Banana', 'Avocado', 'Mochi', 'Truffle',
  'Pudding', 'Nacho', 'Crumpet', 'Ramen', 'Churro', 'Tempura', 'Bagel',
  'Brioche', 'Falafel', 'Gnocchi', 'Macaron', 'Fondue', 'Croissant', 'Gelato',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateGuestName() {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

function generateGuestAvatar() {
  const animal = pick(AVATARS);
  return `/avatars/${animal}.png`;
}

function generateGuestTag() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const GUEST_KEY = 'superbucin_guest';

export class UserManager {
  constructor() {
    this.user = null;
    this.profile = null;
    this.isGuest = true;
    this._listeners = [];
  }

  async init() {
    if (!supabase) {
      this._loadGuest();
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await this._loadAuthUser(session.user);
    } else {
      this._loadGuest();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        this._passwordRecoveryPending = true;
        this._notify();
        return;
      }
      if (session?.user) {
        await this._loadAuthUser(session.user);
      } else {
        this._loadGuest();
      }
      this._notify();
    });
  }

  _loadGuest() {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(GUEST_KEY));
    } catch { /* ignore */ }

    if (stored?.displayName && stored?.avatarUrl) {
      this.user = null;
      this.isGuest = true;
      this.profile = {
        id: stored.guestId || `guest_${Date.now()}`,
        displayName: stored.displayName,
        username: null,
        avatarUrl: stored.avatarUrl,
        tag: stored.tag || generateGuestTag(),
        bio: '',
        points: 0,
      };
    } else {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.user = null;
      this.isGuest = true;
      this.profile = {
        id: guestId,
        displayName: generateGuestName(),
        username: null,
        avatarUrl: generateGuestAvatar(),
        tag: generateGuestTag(),
        bio: '',
        points: 0,
      };
      localStorage.setItem(GUEST_KEY, JSON.stringify({
        guestId: this.profile.id,
        displayName: this.profile.displayName,
        avatarUrl: this.profile.avatarUrl,
        tag: this.profile.tag,
      }));
    }
    this._notify();
  }

  async _loadAuthUser(authUser) {
    this.user = authUser;
    this.isGuest = false;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (data) {
      this.profile = {
        id: data.id,
        displayName: data.display_name,
        username: data.username,
        avatarUrl: data.avatar_url,
        bio: data.bio || '',
        points: data.points || 0,
      };
    } else {
      this.profile = {
        id: authUser.id,
        displayName: authUser.user_metadata?.display_name || 'Player',
        username: authUser.user_metadata?.username || null,
        avatarUrl: authUser.user_metadata?.avatar_url || generateGuestAvatar(),
        bio: '',
        points: 0,
      };
    }
    this._notify();
  }

  getIdentity() {
    return {
      userId: this.isGuest ? null : this.profile.id,
      displayName: this.profile.displayName,
      username: this.profile.username,
      avatarUrl: this.profile.avatarUrl,
      tag: this.profile.tag || null,
      isGuest: this.isGuest,
    };
  }

  getDisplayLabel() {
    if (this.profile.username) return this.profile.username;
    if (this.profile.tag) return `${this.profile.displayName} #${this.profile.tag}`;
    return this.profile.displayName;
  }

  async signUp(email, password, username, displayName, avatarUrl) {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName || username,
          avatar_url: avatarUrl || this.profile.avatarUrl,
        },
      },
    });

    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async resetPassword(email) {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(newPassword) {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    this._loadGuest();
  }

  async updateProfile(updates) {
    if (!supabase || this.isGuest) return;

    const dbUpdates = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', this.profile.id);

    if (error) throw error;

    Object.assign(this.profile, updates);
    this._notify();
  }

  async fetchStats() {
    if (!supabase || this.isGuest) return [];

    const { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', this.profile.id);

    return data || [];
  }

  async fetchAchievements() {
    if (!supabase || this.isGuest) return { all: [], earned: [] };

    const [{ data: all }, { data: earned }] = await Promise.all([
      supabase.from('achievements').select('*'),
      supabase.from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', this.profile.id),
    ]);

    return { all: all || [], earned: earned || [] };
  }

  async fetchMatchHistory(limit = 20) {
    if (!supabase || this.isGuest) return [];

    const { data } = await supabase
      .from('match_history')
      .select('*')
      .or(`player1_id.eq.${this.profile.id},player2_id.eq.${this.profile.id}`)
      .order('played_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  _notify() {
    this._listeners.forEach((fn) => fn(this));
  }
}
