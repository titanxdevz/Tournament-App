import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../features/auth/auth_provider.dart';
import '../features/wallet/wallet_provider.dart';
import '../config/env.dart';

class DepositScreen extends ConsumerStatefulWidget {
  const DepositScreen({super.key});

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  final _amountController = TextEditingController();
  final List<double> _quickAmounts = [50, 100, 200, 500, 1000, 2000];
  double? _selectedAmount;
  bool _generating = false;
  Map<String, dynamic>? _qrData;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _selectQuickAmount(double amount) {
    setState(() {
      _selectedAmount = amount;
      _amountController.text = amount.toInt().toString();
      _qrData = null;
    });
  }

  void _onAmountChanged(String val) {
    setState(() {
      _selectedAmount = null;
      _qrData = null;
    });
  }

  Future<void> _generateQr() async {
    final amountText = _amountController.text.trim();
    if (amountText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an amount')),
      );
      return;
    }

    final amount = double.tryParse(amountText);
    if (amount == null || amount < 15) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Minimum deposit is ₹15')),
      );
      return;
    }

    setState(() => _generating = true);

    final token = ref.read(authProvider).accessToken!;
    final result = await ref.read(walletProvider.notifier).generateQr(amount, token);

    setState(() {
      _generating = false;
      if (result != null) {
        _qrData = result;
      }
    });

    if (mounted && result == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to generate QR. Try again.'), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _openUpiApp(String upiLink) async {
    final uri = Uri.parse(upiLink);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      final encodedLink = Uri.encodeFull(upiLink);
      final fallbackUri = Uri.parse(encodedLink);
      if (await canLaunchUrl(fallbackUri)) {
        await launchUrl(fallbackUri, mode: LaunchMode.externalApplication);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No UPI app found. Please use GPay, PhonePe, or Paytm.')),
        );
      }
    }
  }

  Future<void> _openSpecificUpiApp(String package, String upiLink) async {
    final uri = Uri.parse(upiLink);
    try {
      await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
        webOnlyWindowName: package,
      );
    } catch (_) {
      await _openUpiApp(upiLink);
    }
  }

  @override
  Widget build(BuildContext context) {
    final merchantUpi = Env.merchantUpiId;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121824),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Add Cash',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.red.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
            ),
            child: const Text(
              '92LR',
              style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.indigo.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.account_balance_wallet, color: Colors.indigoAccent, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Deposit via UPI',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text('Pay to: ', style: TextStyle(color: Colors.grey, fontSize: 13)),
                      Text(
                        merchantUpi,
                        style: const TextStyle(
                          color: Colors.indigoAccent,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('UPI ID Copied!'), duration: Duration(seconds: 1)),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.indigo.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.copy, color: Colors.indigoAccent, size: 14),
                              SizedBox(width: 4),
                              Text('Copy', style: TextStyle(color: Colors.indigoAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'SELECT AMOUNT',
              style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _quickAmounts.map((amount) {
                final isSelected = _selectedAmount == amount;
                return GestureDetector(
                  onTap: () => _selectQuickAmount(amount),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? const LinearGradient(colors: [Color(0xFFE50914), Color(0xFFB81D24)])
                          : null,
                      color: isSelected ? null : const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? Colors.redAccent : Colors.white.withOpacity(0.06),
                        width: isSelected ? 0 : 1,
                      ),
                      boxShadow: isSelected
                          ? [BoxShadow(color: Colors.red.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))]
                          : [],
                    ),
                    child: Text(
                      '₹${amount.toInt()}',
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey.shade300,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Row(
                children: [
                  const Text('₹', style: TextStyle(color: Colors.grey, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _amountController,
                      onChanged: _onAmountChanged,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                      decoration: const InputDecoration(
                        hintText: 'Enter custom amount',
                        hintStyle: TextStyle(color: Colors.blueGrey, fontSize: 15),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  if (_amountController.text.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _amountController.clear();
                        setState(() {
                          _selectedAmount = null;
                          _qrData = null;
                        });
                      },
                      child: const Icon(Icons.cancel, color: Color(0xFF9E9E9E), size: 18),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text('Min ₹15', style: const TextStyle(color: Color(0xFF757575), fontSize: 11)),

            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: _generating ? null : _generateQr,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent.shade700,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: _generating
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.qr_code_2, size: 20),
                          SizedBox(width: 10),
                          Text('Pay Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ],
                      ),
              ),
            ),

            if (_qrData != null) ...[
              const SizedBox(height: 28),
              _buildQrSection(_qrData!),
            ],

            const SizedBox(height: 32),
            const Text(
              'HOW IT WORKS',
              style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
            const SizedBox(height: 14),
            _buildStep(1, 'Pay', 'Scan QR or tap a UPI app below to pay the amount.'),
            const SizedBox(height: 10),
            _buildStep(2, 'UTR Code', 'Copy the transaction UTR / Ref ID from your UPI app after payment.'),
            const SizedBox(height: 10),
            _buildStep(3, 'Submit', 'Go to Wallet & submit the UTR to get credited instantly.'),
          ],
        ),
      ),
    );
  }

  Widget _buildQrSection(Map<String, dynamic> qrData) {
    final qrDataUrl = qrData['qrDataUrl'] as String;
    final upiLink = qrData['upiLink'] as String;
    final amount = qrData['amount'] as num;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
        boxShadow: [
          BoxShadow(color: Colors.red.withOpacity(0.08), blurRadius: 24, offset: const Offset(0, 8)),
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
                child: const Icon(Icons.check_circle, color: Colors.greenAccent, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                'Pay ₹${amount.toStringAsFixed(0)}',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Image.memory(
              base64Decode(qrDataUrl.split(',').last),
              width: 200,
              height: 200,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Scan with any UPI app',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
          const SizedBox(height: 20),
          const Text(
            'Open in UPI App',
            style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _upiAppButton(
                  'Google Pay',
                  'assets/icons/gpay.png',
                  Colors.blue.shade800,
                  () => _openSpecificUpiApp('com.google.android.apps.nbu.paisa.user', upiLink),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _upiAppButton(
                  'PhonePe',
                  'assets/icons/phonepe.png',
                  Colors.deepPurple.shade700,
                  () => _openSpecificUpiApp('com.phonepe.app', upiLink),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _upiAppButton(
                  'Paytm',
                  'assets/icons/paytm.png',
                  Colors.cyan.shade800,
                  () => _openSpecificUpiApp('net.one97.paytm', upiLink),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _openUpiApp(upiLink),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withOpacity(0.2)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: const Text('Other UPI App', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _upiAppButton(String name, String iconPath, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  name[0],
                  style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              name,
              style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 10, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(int stepNum, String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28, height: 28,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFFE50914), Color(0xFFB81D24)]),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '$stepNum',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 2),
              Text(desc, style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }
}
