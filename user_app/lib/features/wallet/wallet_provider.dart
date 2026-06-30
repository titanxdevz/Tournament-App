import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../config/env.dart';

class WalletInfo {
  final double winningBalance;
  final double depositBalance;
  final double bonusBalance;
  final double lockedBalance;
  final double refundBalance;
  final List<dynamic> transactions;

  WalletInfo({
    required this.winningBalance,
    required this.depositBalance,
    required this.bonusBalance,
    required this.lockedBalance,
    required this.refundBalance,
    required this.transactions,
  });

  factory WalletInfo.fromJson(Map<String, dynamic> json) {
    return WalletInfo(
      winningBalance: double.parse(json['winningBalance'].toString()),
      depositBalance: double.parse(json['depositBalance'].toString()),
      bonusBalance: double.parse(json['bonusBalance'].toString()),
      lockedBalance: double.parse(json['lockedBalance'].toString()),
      refundBalance: double.parse(json['refundBalance'].toString()),
      transactions: json['transactions'] ?? [],
    );
  }
}

class WalletNotifier extends StateNotifier<AsyncValue<WalletInfo>> {
  final _dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  WalletNotifier() : super(const AsyncValue.loading());

  Future<void> fetchWallet(String token) async {
    state = const AsyncValue.loading();
    try {
      final res = await _dio.get(
        '/wallet',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      state = AsyncValue.data(WalletInfo.fromJson(res.data['wallet']));
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> initiateDeposit(double amount, String upiId, String utr, File screenshot, String token) async {
    try {
      final filename = screenshot.path.split('/').last;
      final formData = FormData.fromMap({
        'amount': amount.toString(),
        'upiId': upiId,
        'utr': utr,
        'screenshot': await MultipartFile.fromFile(screenshot.path, filename: filename),
      });

      await _dio.post(
        '/wallet/deposit',
        data: formData,
        options: Options(headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'multipart/form-data',
        }),
      );
      await fetchWallet(token);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> generateQr(double amount, String token) async {
    try {
      final res = await _dio.post(
        '/wallet/generate-qr',
        data: {'amount': amount},
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return res.data;
    } catch (_) {
      return null;
    }
  }

  Future<bool> requestWithdrawal(double amount, String upiId, String token) async {
    try {
      await _dio.post(
        '/wallet/withdraw',
        data: {
          'amount': amount,
          'upiId': upiId,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      await fetchWallet(token);
      return true;
    } catch (_) {
      return false;
    }
  }
}

final walletProvider = StateNotifierProvider<WalletNotifier, AsyncValue<WalletInfo>>((ref) {
  return WalletNotifier();
});
