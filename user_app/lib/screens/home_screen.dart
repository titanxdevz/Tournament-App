import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'dart:async';
import 'package:crypto/crypto.dart';
import '../features/auth/auth_provider.dart';
import '../features/tournament/tournament_provider.dart';
import '../features/wallet/wallet_provider.dart';
import '../features/socket/socket_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedGameFilter = 'All';

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final token = ref.read(authProvider).accessToken;
      if (token != null) {
        ref.read(walletProvider.notifier).fetchWallet(token);
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _handleRefresh() async {
    final token = ref.read(authProvider).accessToken;
    if (token != null) {
      ref.read(walletProvider.notifier).fetchWallet(token);
    }
    ref.read(tournamentListProvider.notifier).fetchTournaments();
  }

  String _getGravatarUrl(String email) {
    final cleanEmail = email.trim().toLowerCase();
    final hash = md5.convert(utf8.encode(cleanEmail)).toString();
    return 'https://www.gravatar.com/avatar/$hash?s=200&d=identicon';
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(socketProvider);

    final authState = ref.watch(authProvider);
    final walletState = ref.watch(walletProvider);
    final tournamentsState = ref.watch(tournamentListProvider);
    final user = authState.userProfile;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: [
            _buildHomeTab(authState, walletState, tournamentsState, user),
            _buildWalletTab(walletState),
            _buildProfileTab(authState, walletState),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white10, width: 0.5)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          backgroundColor: const Color(0xFF0C111E),
          selectedItemColor: Colors.redAccent,
          unselectedItemColor: Colors.grey.shade500,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontSize: 11),
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home, color: Colors.redAccent),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.account_balance_wallet_outlined),
              activeIcon: Icon(Icons.account_balance_wallet, color: Colors.redAccent),
              label: 'Wallet',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person, color: Colors.redAccent),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeTab(
    AuthState authState,
    AsyncValue<WalletInfo> walletState,
    AsyncValue<List<Tournament>> tournamentsState,
    Map<String, dynamic>? user,
  ) {
    return RefreshIndicator(
      onRefresh: _handleRefresh,
      color: Colors.redAccent,
      backgroundColor: const Color(0xFF121824),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            _buildHeader(user),
            walletState.when(
              data: (wallet) => _buildBalanceCard(wallet),
              loading: () => const SizedBox(height: 120),
              error: (_, __) => const SizedBox(height: 120),
            ),
            _buildQuickActions(),
            _buildSearchAndFilters(),
            _buildSectionHeader('MATCH TOURNAMENTS', Icons.sports_esports),
            _buildTournamentSection(tournamentsState),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(Map<String, dynamic>? user) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFFE50914), Color(0xFFB81D24)]),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [BoxShadow(color: Colors.red.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: const Text(
                  '92LR',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, letterSpacing: 1.5),
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome back,',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                  ),
                  Text(
                    user?['name']?.toString().split(' ')[0] ?? 'Player',
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
          CircleAvatar(
            radius: 20,
            backgroundColor: Colors.red.withOpacity(0.1),
            backgroundImage: NetworkImage(_getGravatarUrl(user?['email'] ?? 'test@example.com')),
          ),
        ],
      ),
    );
  }

  Widget _buildBalanceCard(WalletInfo wallet) {
    final totalBal = wallet.winningBalance + wallet.depositBalance + wallet.bonusBalance;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
        boxShadow: [
          BoxShadow(color: Colors.red.withOpacity(0.06), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.account_balance_wallet, color: Colors.greenAccent, size: 20),
              ),
              const SizedBox(width: 12),
              const Text('TOTAL BALANCE', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('LIVE', style: TextStyle(color: Colors.greenAccent, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            '₹${totalBal.toStringAsFixed(2)}',
            style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 1),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _miniStat('Deposit', '₹${wallet.depositBalance.toStringAsFixed(0)}', Colors.indigoAccent),
              Container(width: 1, height: 30, color: Colors.white.withOpacity(0.06)),
              _miniStat('Winnings', '₹${wallet.winningBalance.toStringAsFixed(0)}', Colors.amberAccent),
              Container(width: 1, height: 30, color: Colors.white.withOpacity(0.06)),
              _miniStat('Bonus', '₹${wallet.bonusBalance.toStringAsFixed(0)}', Colors.redAccent),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 15)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 10)),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Row(
        children: [
          Expanded(child: _actionButton('Add Cash', Icons.add_circle_outline, Colors.greenAccent, () => context.push('/deposit'))),
          const SizedBox(width: 10),
          Expanded(child: _actionButton('Withdraw', Icons.arrow_outward, Colors.amberAccent, () => context.push('/withdraw'))),
          const SizedBox(width: 10),
          Expanded(child: _actionButton('Refer', Icons.card_giftcard, Colors.redAccent, () => context.push('/referral'))),
        ],
      ),
    );
  }

  Widget _actionButton(String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF161C2A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(label, style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.redAccent, size: 18),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const Spacer(),
          GestureDetector(
            onTap: () => setState(() => _currentIndex = 1),
            child: Text('View All', style: TextStyle(color: Colors.redAccent.shade200, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildTournamentSection(AsyncValue<List<Tournament>> tournamentsState) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: tournamentsState.when(
        data: (list) {
          // Apply filters
          List<Tournament> filteredList = list;
          if (_searchQuery.isNotEmpty) {
            filteredList = filteredList.where((t) => t.title.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
          }
          if (_selectedGameFilter != 'All') {
            filteredList = filteredList.where((t) => t.gameType.toUpperCase() == _selectedGameFilter.toUpperCase().replaceAll(' ', '_')).toList();
          }

          if (filteredList.isEmpty) {
            return Container(
              padding: const EdgeInsets.all(40),
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF161C2A),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.03)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.sports_esports, color: Colors.grey, size: 48),
                  SizedBox(height: 12),
                  Text('No matching tournaments found', style: TextStyle(color: Colors.grey, fontSize: 13)),
                ],
              ),
            );
          }

          final hasFeatured = _searchQuery.isEmpty && _selectedGameFilter == 'All';
          final featuredItem = hasFeatured ? filteredList.first : null;
          final remainingList = hasFeatured ? filteredList.sublist(1) : filteredList;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (featuredItem != null) ...[
                _featuredTournamentCard(featuredItem),
                if (remainingList.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12, top: 4),
                    child: Text(
                      'ALL ACTIVE SPECIFICATIONS',
                      style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                    ),
                  ),
                ],
              ],
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: remainingList.length,
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _compactTournamentCard(remainingList[index]),
                ),
              ),
            ],
          );
        },
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: CircularProgressIndicator(color: Colors.redAccent),
          ),
        ),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: Column(
              children: [
                const Icon(Icons.cloud_off, color: Colors.grey, size: 40),
                const SizedBox(height: 8),
                Text('Failed to load', style: TextStyle(color: Colors.grey.shade500)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _compactTournamentCard(Tournament item) {
    final progress = item.filledSlots / item.maxSlots;

    return GestureDetector(
      onTap: () => context.push('/tournament/${item.id}'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF161C2A),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withOpacity(0.04)),
        ),
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
                image: item.imageUrl != null && item.imageUrl!.isNotEmpty
                    ? DecorationImage(
                        image: NetworkImage(item.imageUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                  ? null
                  : Center(
                      child: Text(
                        item.gameType.isNotEmpty ? item.gameType[0].toUpperCase() : 'G',
                        style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 20),
                      ),
                    ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: item.status == 'LIVE' ? Colors.green.withOpacity(0.15) : Colors.grey.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          item.status,
                          style: TextStyle(
                            color: item.status == 'LIVE' ? Colors.greenAccent : Colors.grey,
                            fontSize: 9, fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _tag('₹${item.prizePool}', Icons.emoji_events, Colors.amberAccent),
                      const SizedBox(width: 12),
                      _tag('₹${item.entryFee}', Icons.monetization_on, Colors.indigoAccent),
                      if (item.status == 'UPCOMING') ...[
                        TournamentCountdown(startTime: item.startTime),
                      ] else ...[
                        Text(
                          '${item.filledSlots}/${item.maxSlots}',
                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                        ),
                      ],
                      const Spacer(),
                      SizedBox(
                        width: 60,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress,
                            backgroundColor: Colors.black26,
                            color: Colors.redAccent,
                            minHeight: 4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tag(String text, IconData icon, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3),
        Text(text, style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildWalletTab(AsyncValue<WalletInfo> walletState) {
    return RefreshIndicator(
      onRefresh: _handleRefresh,
      color: Colors.redAccent,
      backgroundColor: const Color(0xFF121824),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            const Text('MY WALLET', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('Manage your funds & transactions', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
            const SizedBox(height: 20),
            walletState.when(
              data: (wallet) {
                final totalBal = wallet.winningBalance + wallet.depositBalance + wallet.bonusBalance;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFE50914), Color(0xFFB81D24)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [BoxShadow(color: Colors.red.withOpacity(0.2), blurRadius: 16, offset: const Offset(0, 8))],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('AVAILABLE BALANCE', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                          const SizedBox(height: 8),
                          Text('₹${totalBal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () => context.push('/deposit'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    foregroundColor: Colors.red.shade900,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    elevation: 0,
                                  ),
                                  icon: const Icon(Icons.add_circle_outline, size: 18),
                                  label: const Text('Add Funds', style: TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => context.push('/withdraw'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white,
                                    side: const BorderSide(color: Colors.white54, width: 1.5),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                  ),
                                  icon: const Icon(Icons.arrow_outward_outlined, size: 18),
                                  label: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text('BALANCE BREAKDOWN', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                    const SizedBox(height: 12),
                    _balanceTile('Deposited Cash', wallet.depositBalance, 'Use to join tournaments', Colors.greenAccent, Icons.wallet),
                    const SizedBox(height: 10),
                    _balanceTile('Winning Cash', wallet.winningBalance, 'Available for withdrawal', Colors.amberAccent, Icons.emoji_events),
                    const SizedBox(height: 10),
                    _balanceTile('Referral Bonus', wallet.bonusBalance, 'Promotional cash bonus', Colors.redAccent, Icons.card_giftcard),
                    const SizedBox(height: 10),
                    _balanceTile('Refund Balance', wallet.refundBalance, 'From cancellations', Colors.indigoAccent, Icons.replay),
                    const SizedBox(height: 28),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('RECENT TRANSACTIONS', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                        if (wallet.transactions.length > 5)
                          Text('View all →', style: TextStyle(color: Colors.redAccent.shade200, fontSize: 11, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (wallet.transactions.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          color: const Color(0xFF161C2A),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Center(child: Text('No transactions yet', style: TextStyle(color: Colors.grey, fontSize: 13))),
                      )
                    else
                      ...List.generate(
                        wallet.transactions.length > 8 ? 8 : wallet.transactions.length,
                        (i) {
                          final tx = wallet.transactions[i];
                          final amount = double.parse(tx['amount'].toString());
                          final isDebit = tx['type'] == 'JOIN_FEE' || tx['type'] == 'WITHDRAWAL';
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF161C2A),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: Colors.white.withOpacity(0.03)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: isDebit ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      isDebit ? Icons.arrow_upward : Icons.arrow_downward,
                                      size: 16,
                                      color: isDebit ? Colors.redAccent : Colors.greenAccent,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          tx['type'].toString().replaceAll('_', ' '),
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          tx['createdAt'].toString().substring(0, 10),
                                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${isDebit ? "-" : "+"} ₹${amount.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      color: isDebit ? Colors.redAccent : Colors.greenAccent,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 15,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                );
              },
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 60),
                  child: CircularProgressIndicator(color: Colors.redAccent),
                ),
              ),
              error: (_, __) => Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: const Color(0xFF161C2A),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
                      SizedBox(height: 8),
                      Text('Failed to load wallet', style: TextStyle(color: Colors.redAccent)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _balanceTile(String title, double val, String subtitle, Color dotColor, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161C2A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: dotColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: dotColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          Text('₹${val.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildProfileTab(AuthState authState, AsyncValue<WalletInfo> walletState) {
    final user = authState.userProfile;
    final wallet = walletState.whenOrNull(data: (w) => w);
    final totalBal = wallet != null
        ? wallet.winningBalance + wallet.depositBalance + wallet.bonusBalance
        : 0.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          const Text('PROFILE', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF161C2A),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: Colors.red.withOpacity(0.1),
                  backgroundImage: NetworkImage(_getGravatarUrl(user?['email'] ?? 'test@example.com')),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?['name'] ?? 'Player',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(user?['email'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('ACTIVE', style: TextStyle(color: Colors.greenAccent, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF241518), Color(0xFF161012)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.redAccent.withOpacity(0.15)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.account_balance_wallet, color: Colors.redAccent, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Balance', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      const SizedBox(height: 4),
                      Text('₹${totalBal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
                const Icon(Icons.visibility, color: Colors.grey, size: 20),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('ACCOUNT INFO', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const SizedBox(height: 12),
          _infoTile(Icons.person_outline, 'Full Name', user?['name'] ?? 'N/A'),
          const SizedBox(height: 8),
          _infoTile(Icons.email_outlined, 'Email', user?['email'] ?? 'N/A'),
          const SizedBox(height: 8),
          _infoTile(Icons.tag, 'Referral Code', user?['referralCode'] ?? 'N/A'),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => ref.read(authProvider.notifier).logout(),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
                side: const BorderSide(color: Colors.redAccent, width: 1.5),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(Icons.logout_outlined),
              label: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF161C2A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.03)),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey, size: 18),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          const Spacer(),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters() {
    final games = ['All', 'BGMI', 'Free Fire', 'Valorant'];
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Column(
        children: [
          // Search Field
          TextField(
            controller: _searchController,
            onChanged: (val) {
              setState(() {
                _searchQuery = val;
              });
            },
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Search tournaments...',
              hintStyle: const TextStyle(color: Colors.grey, fontSize: 13),
              prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 18),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, color: Colors.grey, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _searchQuery = '';
                        });
                      },
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFF161C2A),
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.redAccent.withOpacity(0.5)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Game filters horizontal list
          SizedBox(
            height: 38,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: games.length,
              itemBuilder: (context, index) {
                final game = games[index];
                final isSelected = _selectedGameFilter == game;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(
                      game,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey.shade400,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                    ),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _selectedGameFilter = game;
                        });
                      }
                    },
                    selectedColor: Colors.redAccent,
                    backgroundColor: const Color(0xFF161C2A),
                    side: BorderSide.none,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                    showCheckmark: false,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _featuredTournamentCard(Tournament item) {
    final progress = item.filledSlots / item.maxSlots;

    return GestureDetector(
      onTap: () => context.push('/tournament/${item.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
          boxShadow: [
            BoxShadow(
              color: Colors.red.withOpacity(0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              // Banner Image
              if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
                Image.network(
                  item.imageUrl!,
                  width: double.infinity,
                  height: 200,
                  fit: BoxFit.cover,
                )
              else
                Container(
                  width: double.infinity,
                  height: 200,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFE50914), Color(0xFF1E293B)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.sports_esports,
                      color: Colors.white.withOpacity(0.2),
                      size: 80,
                    ),
                  ),
                ),
              // Dark gradient overlay
              Container(
                width: double.infinity,
                height: 200,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.85),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
              // Content overlay
              Positioned(
                top: 16,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: item.status == 'LIVE' ? Colors.green : Colors.redAccent,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: (item.status == 'LIVE' ? Colors.green : Colors.redAccent).withOpacity(0.4),
                        blurRadius: 8,
                      )
                    ]
                  ),
                  child: Text(
                    item.status == 'LIVE' ? '🔥 LIVE MATCH' : '🏆 FEATURED',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                ),
              ),
              Positioned(
                bottom: 16,
                left: 16,
                right: 16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, shadows: [Shadow(color: Colors.black, blurRadius: 4, offset: Offset(1, 1))]),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _tag('Pool: ₹${item.prizePool}', Icons.emoji_events, Colors.amberAccent),
                        const SizedBox(width: 16),
                        _tag('Fee: ₹${item.entryFee}', Icons.monetization_on, Colors.indigoAccent),
                        const Spacer(),
                        if (item.status == 'UPCOMING')
                          TournamentCountdown(startTime: item.startTime)
                        else
                          Text(
                            '${item.filledSlots}/${item.maxSlots} Joined',
                            style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: Colors.white24,
                        color: Colors.redAccent,
                        minHeight: 4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TournamentCountdown extends StatefulWidget {
  final DateTime startTime;
  const TournamentCountdown({super.key, required this.startTime});

  @override
  State<TournamentCountdown> createState() => _TournamentCountdownState();
}

class _TournamentCountdownState extends State<TournamentCountdown> {
  late Timer _timer;
  late Duration _timeLeft;

  @override
  void initState() {
    super.initState();
    _calculateTimeLeft();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _calculateTimeLeft();
        });
      }
    });
  }

  void _calculateTimeLeft() {
    _timeLeft = widget.startTime.difference(DateTime.now());
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_timeLeft.isNegative) {
      return const Text(
        'STARTED',
        style: TextStyle(color: Colors.greenAccent, fontSize: 11, fontWeight: FontWeight.bold),
      );
    }

    final hours = _timeLeft.inHours.toString().padLeft(2, '0');
    final minutes = (_timeLeft.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_timeLeft.inSeconds % 60).toString().padLeft(2, '0');

    return Text(
      'Starts in: $hours:$minutes:$seconds',
      style: const TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold),
    );
  }
}
