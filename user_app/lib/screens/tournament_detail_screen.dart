import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/auth_provider.dart';
import '../features/tournament/tournament_provider.dart';
import '../features/wallet/wallet_provider.dart';

class TournamentDetailScreen extends ConsumerStatefulWidget {
  final String tournamentId;
  const TournamentDetailScreen({super.key, required this.tournamentId});

  @override
  ConsumerState<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends ConsumerState<TournamentDetailScreen> {
  final _inGameNameController = TextEditingController();
  final _inGameIdController = TextEditingController();
  bool _isJoining = false;

  @override
  void dispose() {
    _inGameNameController.dispose();
    _inGameIdController.dispose();
    super.dispose();
  }

  void _showJoinSheet(Tournament tournament) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF121824),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Confirm Registration',
                style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Entry Fee: ₹${tournament.entryFee} will be deducted from your wallet.',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 24),
              const Text(
                'In-Game Name (IGN)',
                style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _inGameNameController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'e.g. DynamoYT',
                  hintStyle: const TextStyle(color: Colors.grey),
                  filled: true,
                  fillColor: const Color(0xFF0A0F1D),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'In-Game Character ID',
                style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _inGameIdController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'e.g. 518390124',
                  hintStyle: const TextStyle(color: Colors.grey),
                  filled: true,
                  fillColor: const Color(0xFF0A0F1D),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isJoining ? null : () => _submitJoin(tournament),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: _isJoining
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Confirm & Pay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submitJoin(Tournament tournament) async {
    final name = _inGameNameController.text.trim();
    final id = _inGameIdController.text.trim();

    if (name.isEmpty || id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill in both fields')));
      return;
    }

    final token = ref.read(authProvider).accessToken;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Session expired. Please log in again.')));
      context.go('/login');
      return;
    }

    // Verify user balance from local wallet provider state
    final walletState = ref.read(walletProvider);
    double totalBalance = 0;
    bool hasWalletData = false;
    walletState.whenData((wallet) {
      totalBalance = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;
      hasWalletData = true;
    });

    if (hasWalletData && totalBalance < tournament.entryFee) {
      // Insufficient balance dialog
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF161C2A),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Insufficient Coins', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          content: Text(
            'You need ₹${tournament.entryFee.toStringAsFixed(2)} to join this tournament, but your current balance is ₹${totalBalance.toStringAsFixed(2)}.',
            style: const TextStyle(color: Colors.grey),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.blueGrey)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx); // Close dialog
                Navigator.pop(context); // Close bottom sheet
                context.push('/deposit');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Add Coins', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      return;
    }

    setState(() {
      _isJoining = true;
    });

    final success = await ref.read(tournamentListProvider.notifier).joinTournament(
          tournament.id,
          name,
          id,
          token,
        );

    setState(() {
      _isJoining = false;
    });

    if (mounted) {
      Navigator.pop(context); // Close bottom sheet
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Joined tournament successfully!'), backgroundColor: Colors.green),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to join. Check your balance or character ID.'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tournamentsState = ref.watch(tournamentListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121824),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Match Specification', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: tournamentsState.when(
        data: (list) {
          final tournament = list.firstWhere(
            (element) => element.id == widget.tournamentId,
            orElse: () => throw Exception('Tournament not found'),
          );

          return Hero(
            tag: 'tournament_card_${tournament.id}',
            child: Material(
              type: MaterialType.transparency,
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (tournament.imageUrl != null && tournament.imageUrl!.isNotEmpty) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Image.network(
                                tournament.imageUrl!,
                                width: double.infinity,
                                height: 180,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          Text(
                            tournament.title,
                            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.red.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
                                ),
                                child: Text(
                                  tournament.gameType,
                                  style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'Starts: ${tournament.startTime.toLocal().toString().substring(0, 16)}',
                                style: const TextStyle(color: Colors.grey, fontSize: 12),
                              ),
                            ],
                          ),
                          if (tournament.roomId != null) ...[
                            const SizedBox(height: 28),
                            const Text(
                              'Active Match Room Details',
                              style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: const Color(0xFF161C2A),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.redAccent.withOpacity(0.25)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Text('Room ID: ', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 13)),
                                      SelectableText(
                                        tournament.roomId!,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15),
                                      ),
                                      const Spacer(),
                                      IconButton(
                                        icon: const Icon(Icons.copy, size: 16, color: Colors.grey),
                                        onPressed: () {
                                          Clipboard.setData(ClipboardData(text: tournament.roomId!));
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Room ID copied to clipboard'), backgroundColor: Colors.redAccent),
                                          );
                                        },
                                      )
                                    ],
                                  ),
                                  const Divider(color: Colors.white10),
                                  Row(
                                    children: [
                                      const Text('Password: ', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 13)),
                                      SelectableText(
                                        tournament.roomPassword!,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15),
                                      ),
                                      const Spacer(),
                                      IconButton(
                                        icon: const Icon(Icons.copy, size: 16, color: Colors.grey),
                                        onPressed: () {
                                          Clipboard.setData(ClipboardData(text: tournament.roomPassword!));
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Password copied to clipboard'), backgroundColor: Colors.redAccent),
                                          );
                                        },
                                      )
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 28),
                          const Text(
                            'Rules & Regulations',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF161C2A),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              tournament.rules,
                              style: const TextStyle(color: Colors.grey, fontSize: 13, height: 1.5),
                            ),
                          ),
                          const SizedBox(height: 28),
                          const Text(
                            'About this Tournament',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF161C2A),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              tournament.description,
                              style: const TextStyle(color: Colors.grey, fontSize: 13, height: 1.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Bottom sticky join gateway bar
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: const BoxDecoration(
                      color: Color(0xFF121824),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      border: Border(
                        top: BorderSide(color: Colors.white10, width: 0.5),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('ENTRY FEE', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(
                              '₹${tournament.entryFee}',
                              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                        const SizedBox(width: 24),
                        Expanded(
                          child: SizedBox(
                            height: 56,
                            child: ElevatedButton(
                              onPressed: tournament.status != 'UPCOMING' ? null : () => _showJoinSheet(tournament),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.redAccent,
                                foregroundColor: Colors.white,
                                disabledBackgroundColor: Colors.white10,
                                disabledForegroundColor: Colors.white30,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: const Text('Join Tournament', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.redAccent)),
        error: (err, _) => Center(child: Text('Error loading tournament details: $err', style: const TextStyle(color: Colors.redAccent))),
      ),
    );
  }
}
