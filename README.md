# Ergo Miner Rewarder Bot

Sends native tokens and ERGs to a random miner every configured block interval. 

## Setup

install [bun](https://bun.sh/)

install dependencies
```bash
bun install
```
Fill out .env, you can use the .env.example as a guide.

Note: You can find address index by counting the addresses shown in the receive section of nautilus wallet. The bottom most is index 0.

Fill out `params.json`

- startBlockHeight
  - block number to start selecting miner from
  - bot automatically saves the new startBlockHeight after rewarding
- rewardInterval
  - Bot rewards one random miner from this set of blocks
- rewardToken
  - token to reward miner
  - amount must **not** contain decimals
  - If I wanted to reward 
    - 1000 comet, set `1000` (note 0 decimals)
    - 1 sigusd, set `100` (note two decimals)
- nanoErgPerTx
  - nanoERGs to send to miner
  - 1 ERG = 10^9 nanoERG
- nanoErgMinerFee
  - nanoERGs tx fee
- nodeUrl
  - node url with exposed api (port 9053)
  - testnet supported
- explorerApi
  - explorer api url
  - testnet supported
- blacklist
  - array of miner addresses to prevent rewarding
  - find list [here](https://ergexplorer.com/addressbook#offset=0&type=mining-pool)
  - If I wanted to blacklist 2miners pool
    - ["88dhgzEuTXaRQTX5KNdnaWTTX7fEZVEQRn6qP4MJotPuRnS3QpoJxYpSaXoU1y7SHp8ZXMp92TH22DBY"]
  - If I wanted to blacklist 2miner pool and DX pool
    - ["88dhgzEuTXaRQTX5KNdnaWTTX7fEZVEQRn6qP4MJotPuRnS3QpoJxYpSaXoU1y7SHp8ZXMp92TH22DBY", "88dhgzEuTXaUPpNAbKL7UeNUFEcjkoqW6ev5P1hkynBmG4L5baYdZ8rSPYCDNmvwBLiJR7ABjndPhqGm"]

Run program with
```bash
bun start
```

## Docker
Fill out .env

run as such
```bash
docker compose up -d
```

check logs
```bash
docker compose logs -f
```

kill program
```bash
docker compose down
```

## License

MIT
