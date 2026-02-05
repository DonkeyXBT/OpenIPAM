const SubnetCalculator = {
    calculate(ip, cidr) {
        if (!IPUtils.isValidIP(ip)) {
            return { error: 'Invalid IP address' };
        }
        cidr = parseInt(cidr);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            return { error: 'Invalid CIDR (must be 0-32)' };
        }
        const networkAddress = IPUtils.getNetworkAddress(ip, cidr);
        const broadcastAddress = IPUtils.getBroadcastAddress(networkAddress, cidr);
        const totalHosts = IPUtils.getTotalHosts(cidr);
        const networkInt = IPUtils.ipToInt(networkAddress);
        const firstUsable = cidr < 31 ? IPUtils.intToIp(networkInt + 1) : networkAddress;
        const lastUsable = cidr < 31 ? IPUtils.intToIp(networkInt + totalHosts) : broadcastAddress;
        const maskInt = (-1 << (32 - cidr)) >>> 0;
        const subnetMask = IPUtils.intToIp(maskInt);
        const wildcardInt = ~maskInt >>> 0;
        const wildcardMask = IPUtils.intToIp(wildcardInt);
        const firstOctet = parseInt(ip.split('.')[0]);
        let ipClass = 'E';
        if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'A';
        else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'B';
        else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'C';
        else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'D (Multicast)';
        const isPrivate = this.isPrivateIP(ip);
        return {
            inputIP: ip,
            cidr,
            networkAddress,
            broadcastAddress,
            subnetMask,
            wildcardMask,
            firstUsableIP: firstUsable,
            lastUsableIP: lastUsable,
            totalHosts,
            usableHosts: cidr < 31 ? totalHosts : (cidr === 31 ? 2 : 1),
            ipClass,
            isPrivate,
            binaryMask: this.toBinary(maskInt),
            notation: `${networkAddress}/${cidr}`
        };
    },
    isPrivateIP(ip) {
        const parts = ip.split('.').map(Number);
        if (parts[0] === 10) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        return false;
    },
    toBinary(num) {
        return (num >>> 0).toString(2).padStart(32, '0').match(/.{8}/g).join('.');
    },
    calculateSupernet(subnets) {
        if (!subnets || subnets.length < 2) {
            return { error: 'Need at least 2 subnets' };
        }
        let minIP = Infinity;
        let maxIP = 0;
        subnets.forEach(s => {
            const networkInt = IPUtils.ipToInt(s.network);
            const broadcastInt = IPUtils.ipToInt(IPUtils.getBroadcastAddress(s.network, s.cidr));
            minIP = Math.min(minIP, networkInt);
            maxIP = Math.max(maxIP, broadcastInt);
        });
        const range = maxIP - minIP + 1;
        const bitsNeeded = Math.ceil(Math.log2(range));
        const newCidr = 32 - bitsNeeded;
        const newNetwork = IPUtils.getNetworkAddress(IPUtils.intToIp(minIP), newCidr);
        return {
            network: newNetwork,
            cidr: newCidr,
            notation: `${newNetwork}/${newCidr}`,
            totalHosts: IPUtils.getTotalHosts(newCidr)
        };
    },
    splitSubnet(network, cidr, newCidr) {
        if (newCidr <= cidr) {
            return { error: 'New CIDR must be larger than current' };
        }
        const numSubnets = Math.pow(2, newCidr - cidr);
        const subnets = [];
        const baseInt = IPUtils.ipToInt(network);
        const subnetSize = Math.pow(2, 32 - newCidr);
        for (let i = 0; i < numSubnets; i++) {
            const subnetNetwork = IPUtils.intToIp(baseInt + (i * subnetSize));
            subnets.push({
                network: subnetNetwork,
                cidr: newCidr,
                notation: `${subnetNetwork}/${newCidr}`,
                totalHosts: IPUtils.getTotalHosts(newCidr)
            });
        }
        return { subnets };
    }
};
