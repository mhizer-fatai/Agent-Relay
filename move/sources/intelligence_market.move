module agent_relay::intelligence_market {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use std::string::String;
    use std::option::{Self, Option};

    public struct AgentState has key, store {
        id: UID,
        owner: address,
        current_blob_id: String,
        parent_blob_id: Option<String>,
    }

    public struct MemoryPackNFT has key, store {
        id: UID,
        creator: address,
        title: String,
        encrypted_blob_id: String,
        price: u64
    }

    public struct Marketplace has key {
        id: UID,
        listings: Table<ID, MemoryPackNFT>
    }

    public struct AgentCreated has copy, drop {
        agent_id: ID,
        owner: address,
        current_blob_id: String,
        parent_blob_id: Option<String>
    }

    public struct AgentStateUpdated has copy, drop {
        agent_id: ID,
        owner: address,
        new_blob_id: String
    }

    public struct MemoryPackListed has copy, drop {
        pack_id: ID,
        creator: address,
        title: String,
        price: u64,
        encrypted_blob_id: String
    }

    public struct MemoryPackPurchased has copy, drop {
        pack_id: ID,
        buyer: address,
        price: u64
    }

    fun init(ctx: &mut TxContext) {
        let market = Marketplace {
            id: object::new(ctx),
            listings: table::new(ctx)
        };
        sui::transfer::share_object(market);
    }

    public entry fun register_agent(current_blob_id: String, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let agent_id = object::uid_to_inner(&id);

        let agent = AgentState {
            id,
            owner: sender,
            current_blob_id,
            parent_blob_id: option::none()
        };

        event::emit(AgentCreated {
            agent_id,
            owner: sender,
            current_blob_id,
            parent_blob_id: option::none()
        });

        sui::transfer::public_transfer(agent, sender);
    }

    public entry fun update_agent_state(agent: &mut AgentState, new_blob_id: String, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(agent.owner == sender, 0); // Ensures only the owner can update the agent's state

        agent.current_blob_id = new_blob_id;

        event::emit(AgentStateUpdated {
            agent_id: object::uid_to_inner(&agent.id),
            owner: sender,
            new_blob_id
        });
    }

    public entry fun fork_agent(parent: &AgentState, current_blob_id: String, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let agent_id = object::uid_to_inner(&id);
        let parent_blob = option::some(parent.current_blob_id);

        let child = AgentState {
            id,
            owner: sender,
            current_blob_id,
            parent_blob_id: parent_blob
        };

        event::emit(AgentCreated {
            agent_id,
            owner: sender,
            current_blob_id,
            parent_blob_id: parent_blob
        });

        sui::transfer::public_transfer(child, sender);
    }

    public entry fun list_memory_pack(
        market: &mut Marketplace, 
        title: String, 
        encrypted_blob_id: String, 
        price: u64, 
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let pack_id = object::uid_to_inner(&id);

        let nft = MemoryPackNFT {
            id,
            creator: sender,
            title,
            encrypted_blob_id,
            price
        };

        event::emit(MemoryPackListed {
            pack_id,
            creator: sender,
            title,
            price,
            encrypted_blob_id
        });

        table::add(&mut market.listings, pack_id, nft);
    }

    public entry fun purchase_memory_pack(
        market: &mut Marketplace, 
        pack_id: ID, 
        payment: &mut Coin<SUI>, 
        ctx: &mut TxContext
    ) {
        let nft = table::remove(&mut market.listings, pack_id);
        let sender = tx_context::sender(ctx);
        
        let price = nft.price;
        let creator = nft.creator;

        let payment_value = coin::value(payment);
        assert!(payment_value >= price, 1); // Ensures the buyer provided enough payment

        let paid_coin = coin::split(payment, price, ctx);
        sui::transfer::public_transfer(paid_coin, creator);

        event::emit(MemoryPackPurchased {
            pack_id,
            buyer: sender,
            price
        });

        sui::transfer::public_transfer(nft, sender);
    }
}
