import { supabase } from '../supabaseAdmin.js';

const POINTS_FOR_WIN = 100;
const POINTS_FOR_LOSS = 25;
const POINTS_FOR_TIE = 50;
const POINTS_PER_SCORE = 2;

export class UserService {
  static async recordMatch({ gameType, p1, p2, winnerId, scores, isTie }) {
    if (!supabase) return { newAchievements: {} };

    const p1Auth = !p1.identity?.isGuest && p1.identity?.userId;
    const p2Auth = !p2.identity?.isGuest && p2.identity?.userId;

    await supabase.from('match_history').insert({
      game_type: gameType,
      player1_id: p1Auth || null,
      player2_id: p2Auth || null,
      player1_name: p1.identity?.displayName || 'Guest',
      player2_name: p2.identity?.displayName || 'Guest',
      player1_avatar: p1.identity?.avatarUrl || null,
      player2_avatar: p2.identity?.avatarUrl || null,
      winner_id: isTie ? null : (winnerId === p1.id ? (p1Auth || null) : (p2Auth || null)),
      player1_score: scores[0] || 0,
      player2_score: scores[1] || 0,
      is_tie: !!isTie,
    });

    const newAchievements = {};
    const pointsByPlayer = {};

    for (const player of [p1, p2]) {
      const isAuth = !player.identity?.isGuest && player.identity?.userId;
      if (!isAuth) continue;

      const userId = player.identity.userId;
      const isWinner = !isTie && winnerId === player.id;
      const playerScore = player.id === p1.id ? (scores[0] || 0) : (scores[1] || 0);
      const points = isWinner
        ? POINTS_FOR_WIN + (playerScore * POINTS_PER_SCORE)
        : isTie
          ? POINTS_FOR_TIE + (playerScore * POINTS_PER_SCORE)
          : POINTS_FOR_LOSS + (playerScore * POINTS_PER_SCORE);

      await this._updateStats(userId, gameType, isWinner, isTie, points);
      await this._addPoints(userId, points);
      pointsByPlayer[player.id] = points;
      const earned = await this._checkAchievements(userId, gameType);
      if (earned.length > 0) {
        newAchievements[player.id] = earned;
      }
    }

    return { newAchievements, pointsByPlayer };
  }

  static async _updateStats(userId, gameType, isWinner, isTie, points) {
    const { data: existing } = await supabase
      .from('user_stats')
      .select('id, wins, losses, ties, games_played, total_points')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .single();

    if (existing) {
      await supabase.from('user_stats').update({
        wins: existing.wins + (isWinner ? 1 : 0),
        losses: existing.losses + (!isWinner && !isTie ? 1 : 0),
        ties: existing.ties + (isTie ? 1 : 0),
        games_played: existing.games_played + 1,
        total_points: existing.total_points + points,
      }).eq('id', existing.id);
    } else {
      await supabase.from('user_stats').insert({
        user_id: userId,
        game_type: gameType,
        wins: isWinner ? 1 : 0,
        losses: !isWinner && !isTie ? 1 : 0,
        ties: isTie ? 1 : 0,
        games_played: 1,
        total_points: points,
      });
    }
  }

  static async _addPoints(userId, points) {
    const { data } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();

    if (data) {
      await supabase.from('profiles')
        .update({ points: (data.points || 0) + points })
        .eq('id', userId);
    }
  }

  static async _checkAchievements(userId, gameType) {
    const [{ data: stats }, { data: allStats }, { data: existing }, { data: achievements }] = await Promise.all([
      supabase.from('user_stats').select('*').eq('user_id', userId).eq('game_type', gameType).single(),
      supabase.from('user_stats').select('*').eq('user_id', userId),
      supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
      supabase.from('achievements').select('*'),
    ]);

    if (!achievements || !allStats) return [];

    const earnedIds = new Set((existing || []).map((e) => e.achievement_id));
    const totalWins = (allStats || []).reduce((sum, s) => sum + s.wins, 0);
    const totalGames = (allStats || []).reduce((sum, s) => sum + s.games_played, 0);
    const uniqueGameWins = (allStats || []).filter((s) => s.wins > 0).length;
    const gameWins = stats?.wins || 0;

    const newlyEarned = [];

    for (const ach of achievements) {
      if (earnedIds.has(ach.id)) continue;

      let met = false;
      switch (ach.condition_type) {
        case 'total_wins':
          met = totalWins >= ach.condition_value;
          break;
        case 'total_games':
          met = totalGames >= ach.condition_value;
          break;
        case 'game_wins':
          met = ach.category === gameType && gameWins >= ach.condition_value;
          break;
        case 'unique_game_wins':
          met = uniqueGameWins >= ach.condition_value;
          break;
        case 'win_streak':
          met = await this._checkWinStreak(userId, ach.condition_value);
          break;
      }

      if (met) {
        await supabase.from('user_achievements').insert({
          user_id: userId,
          achievement_id: ach.id,
        });
        newlyEarned.push({ id: ach.id, name: ach.name, icon: ach.icon, description: ach.description });
      }
    }

    return newlyEarned;
  }

  static async _checkWinStreak(userId, required) {
    const { data: recent } = await supabase
      .from('match_history')
      .select('winner_id, is_tie, player1_id, player2_id')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('played_at', { ascending: false })
      .limit(required);

    if (!recent || recent.length < required) return false;

    return recent.every((m) => !m.is_tie && m.winner_id === userId);
  }

  static async getProfile(userId) {
    if (!supabase) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }
}
