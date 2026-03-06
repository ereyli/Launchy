#[cfg(test)]
mod tests {
    fn compute_total(price_per_nft: u256, qty: u64) -> u256 {
        let qty_u256: u256 = qty.into();
        price_per_nft * qty_u256
    }

    #[test]
    fn mint_fee_half_strk_in_wei() {
        // 0.5 STRK (18 decimals) => 500_000_000_000_000_000 wei
        let half_strk_wei = u256 { low: 500000000000000000, high: 0 };
        let total = compute_total(half_strk_wei, 2);
        assert(total.low == 1000000000000000000, 'expected 1 STRK in wei');
        assert(total.high == 0, 'unexpected high');
    }

    #[test]
    fn deploy_fee_50_strk() {
        let deploy_fee = u256 { low: 50, high: 0 };
        assert(deploy_fee.low == 50, 'wrong deploy fee');
    }
}
