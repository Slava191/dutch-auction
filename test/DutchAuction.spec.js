const { expect } = require("chai")
const { ethers } = require("hardhat")

const DEFAULT_DURATION = 60
const DEFAULT_PRICE = ethers.utils.parseEther("0.0001")
const DEFAULT_DISCOUNT_RATE = 3

const DEFAULT_AUCTION_DATA = [
  DEFAULT_PRICE, 
  DEFAULT_DISCOUNT_RATE,
  "fake item", 
  DEFAULT_DURATION
]

describe("DutchAuction", function () {
  let owner
  let seller
  let buyer
  let auct

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners()

    const DutchAuction = await ethers.getContractFactory("DutchAuction", owner)
    auct = await DutchAuction.deploy()
    await auct.deployed()
  })

  it("sets owner", async function() {
    const currentOwner = await auct.owner()
    expect(currentOwner).to.eq(owner.address)
  })

  async function getTimestamp(bn) {
    return (await ethers.provider.getBlock(bn)).timestamp
  }

  describe("createAuction", function () {
    it("creates auction correctly", async function() {
      const duration = DEFAULT_DURATION
      const tx = await auct.createAuction(...DEFAULT_AUCTION_DATA)

      await expect(tx)
        .to.emit(auct, 'AuctionCreated')
        .withArgs(0, "fake item", ethers.utils.parseEther("0.0001"), duration)

      const cAuction = await auct.auctions(0)
      expect(cAuction.item).to.eq("fake item")
      const ts = await getTimestamp(tx.blockNumber) // tx.blockNumber - block number in blockchain
      expect(cAuction.endsAt).to.eq(ts + duration)
    })
  })

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  describe("buy", function () {
    it("allows to buy", async function() {
      await auct.connect(seller).createAuction(...DEFAULT_AUCTION_DATA)

      this.timeout(5000) // 5s
      await delay(1000)

      const buyTx = await auct.connect(buyer).
        buy(0, {value: DEFAULT_PRICE})

      const cAuction = await auct.auctions(0)
      const finalPrice = cAuction.finalPrice
      await expect(() => buyTx).
        to.changeEtherBalance(
          seller, finalPrice - Math.floor((finalPrice * 10) / 100)
        )
      
      await expect(buyTx)
        .to.emit(auct, 'AuctionEnded')
        .withArgs(0, finalPrice, buyer.address)
      
      await expect(
        auct.connect(buyer)
          .buy(0, {value: DEFAULT_PRICE})
      ).to.be.revertedWith('stopped!')
    })
  })
})