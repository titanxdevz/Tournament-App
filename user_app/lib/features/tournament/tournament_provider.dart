import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../auth/auth_provider.dart';
import '../../config/env.dart';

class Tournament {
  final String id;
  final String title;
  final String description;
  final String gameType;
  final double entryFee;
  final double prizePool;
  final int maxSlots;
  final int filledSlots;
  final String status;
  final DateTime startTime;
  final String rules;

  final String? roomId;
  final String? roomPassword;
  final String? imageUrl;

  Tournament({
    required this.id,
    required this.title,
    required this.description,
    required this.gameType,
    required this.entryFee,
    required this.prizePool,
    required this.maxSlots,
    required this.filledSlots,
    required this.status,
    required this.startTime,
    required this.rules,
    this.roomId,
    this.roomPassword,
    this.imageUrl,
  });

  factory Tournament.fromJson(Map<String, dynamic> json) {
    final roomJson = json['room'] as Map<String, dynamic>?;

    return Tournament(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      gameType: json['gameType'],
      entryFee: double.parse(json['entryFee'].toString()),
      prizePool: double.parse(json['prizePool'].toString()),
      maxSlots: json['maxSlots'],
      filledSlots: json['filledSlots'],
      status: json['status'],
      startTime: DateTime.parse(json['startTime']),
      rules: json['rules'],
      roomId: roomJson?['roomId']?.toString(),
      roomPassword: roomJson?['roomPassword']?.toString(),
      imageUrl: json['imageUrl']?.toString(),
    );
  }
}

class TournamentListNotifier extends StateNotifier<AsyncValue<List<Tournament>>> {
  final _dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  TournamentListNotifier() : super(const AsyncValue.loading()) {
    fetchTournaments();
  }

  Future<void> fetchTournaments() async {
    state = const AsyncValue.loading();
    try {
      final res = await _dio.get('/tournaments');
      final list = (res.data['tournaments'] as List)
          .map((item) => Tournament.fromJson(item))
          .toList();
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> joinTournament(String tournamentId, String inGameName, String inGameId, String token) async {
    try {
      await _dio.post(
        '/tournaments/$tournamentId/join',
        data: {'inGameName': inGameName, 'inGameId': inGameId},
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      await fetchTournaments();
      return true;
    } catch (_) {
      return false;
    }
  }

  // Add or update a tournament in real-time
  void addOrUpdateTournament(Tournament t) {
    state.whenData((list) {
      final idx = list.indexWhere((item) => item.id == t.id);
      if (idx == -1) {
        state = AsyncValue.data([t, ...list]);
      } else {
        final updatedList = List<Tournament>.from(list);
        updatedList[idx] = t;
        state = AsyncValue.data(updatedList);
      }
    });
  }

  // Remove a tournament in real-time
  void removeTournament(String id) {
    state.whenData((list) {
      final updatedList = list.where((item) => item.id != id).toList();
      state = AsyncValue.data(updatedList);
    });
  }

  // Update tournament slot occupancy in real-time
  void updateTournamentSlots(String id, int filledSlots) {
    state.whenData((list) {
      final idx = list.indexWhere((item) => item.id == id);
      if (idx != -1) {
        final updatedList = List<Tournament>.from(list);
        final current = updatedList[idx];
        updatedList[idx] = Tournament(
          id: current.id,
          title: current.title,
          description: current.description,
          gameType: current.gameType,
          entryFee: current.entryFee,
          prizePool: current.prizePool,
          maxSlots: current.maxSlots,
          filledSlots: filledSlots,
          status: current.status,
          startTime: current.startTime,
          rules: current.rules,
          imageUrl: current.imageUrl,
          roomId: current.roomId,
          roomPassword: current.roomPassword,
        );
        state = AsyncValue.data(updatedList);
      }
    });
  }

  // Update arbitrary tournament details (such as status, room keys, filled slots) in real-time
  void updateTournamentDetails(String id, Map<String, dynamic> updates) {
    state.whenData((list) {
      final idx = list.indexWhere((item) => item.id == id);
      if (idx != -1) {
        final updatedList = List<Tournament>.from(list);
        final current = updatedList[idx];
        
        final roomJson = updates['room'] as Map<String, dynamic>?;
        
        updatedList[idx] = Tournament(
          id: current.id,
          title: updates['title'] ?? current.title,
          description: updates['description'] ?? current.description,
          gameType: updates['gameType'] ?? current.gameType,
          entryFee: updates['entryFee'] != null ? double.parse(updates['entryFee'].toString()) : current.entryFee,
          prizePool: updates['prizePool'] != null ? double.parse(updates['prizePool'].toString()) : current.prizePool,
          maxSlots: updates['maxSlots'] ?? current.maxSlots,
          filledSlots: updates['filledSlots'] ?? current.filledSlots,
          status: updates['status'] ?? current.status,
          startTime: updates['startTime'] != null ? DateTime.parse(updates['startTime']) : current.startTime,
          rules: updates['rules'] ?? current.rules,
          imageUrl: updates['imageUrl'] ?? current.imageUrl,
          roomId: roomJson?['roomId']?.toString() ?? updates['roomId']?.toString() ?? current.roomId,
          roomPassword: roomJson?['roomPassword']?.toString() ?? updates['roomPassword']?.toString() ?? current.roomPassword,
        );
        state = AsyncValue.data(updatedList);
      }
    });
  }
}

final tournamentListProvider =
    StateNotifierProvider<TournamentListNotifier, AsyncValue<List<Tournament>>>((ref) {
  return TournamentListNotifier();
});
