import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../config/env.dart';
import '../tournament/tournament_provider.dart';
import '../auth/auth_provider.dart';

final socketProvider = Provider<IO.Socket?>((ref) {
  final authState = ref.watch(authProvider);
  final token = authState.accessToken;
  
  if (token == null) {
    print('WebSocket: User unauthenticated. Skipping connection.');
    return null;
  }

  // Extract WebSocket root URL from the API base URL
  final wsUrl = Env.apiBaseUrl.replaceAll('/api', '');

  print('Initializing Real-time WebSocket connection to $wsUrl with JWT Auth');

  IO.Socket socket = IO.io(wsUrl, IO.OptionBuilder()
    .setTransports(['websocket']) // Required for modern browser & native client connections
    .setAuth({'token': token})    // Authenticate connection
    .disableAutoConnect()
    .build());

  socket.onConnect((_) {
    print('WebSocket connected successfully: ${socket.id}');
  });

  socket.onDisconnect((_) {
    print('WebSocket disconnected');
  });

  socket.onConnectError((err) {
    print('WebSocket connect error: $err');
  });

  // Listen to new tournament additions
  socket.on('tournament:created', (data) {
    print('WS Event received [tournament:created]: $data');
    if (data != null) {
      try {
        final t = Tournament.fromJson(data);
        ref.read(tournamentListProvider.notifier).addOrUpdateTournament(t);
      } catch (e) {
        print('Error parsing tournament:created data: $e');
      }
    }
  });

  // Listen to slot, status, or detail updates
  socket.on('tournament:updated', (data) {
    print('WS Event received [tournament:updated]: $data');
    if (data != null) {
      try {
        final String id = data['id'];
        ref.read(tournamentListProvider.notifier).updateTournamentDetails(id, data);
      } catch (e) {
        print('Error parsing tournament:updated data: $e');
      }
    }
  });

  // Listen to room released events
  socket.on('room:released', (data) {
    print('WS Event received [room:released]: $data');
    if (data != null) {
      try {
        final String tournamentId = data['tournamentId'];
        ref.read(tournamentListProvider.notifier).updateTournamentDetails(tournamentId, {
          'roomId': data['roomId'],
          'roomPassword': data['roomPassword'],
        });
      } catch (e) {
        print('Error parsing room:released data: $e');
      }
    }
  });

  // Listen to tournament cancellations or deletions
  socket.on('tournament:deleted', (data) {
    print('WS Event received [tournament:deleted]: $data');
    if (data != null) {
      try {
        final String id = data['id'];
        ref.read(tournamentListProvider.notifier).removeTournament(id);
      } catch (e) {
        print('Error parsing tournament:deleted data: $e');
      }
    }
  });

  // Connect manually
  socket.connect();

  ref.onDispose(() {
    print('Disposing WebSocket connection');
    socket.disconnect();
    socket.dispose();
  });

  return socket;
});
